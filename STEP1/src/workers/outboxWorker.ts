import { db } from '../services/db.js';
import { getChannel } from '../services/broker.js';
import { config } from '../config/env.js';

const EXCHANGE = 'iris.events';
const MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 10_000; // ponytail: 10s is plenty — events are durable, not realtime

let timer: NodeJS.Timeout | null = null;
let running = false;

// §1.4 Flow C — outbox worker: poll pending rows, publish with confirms, backoff on failure
export function startOutboxWorker() {
  timer = setInterval(processBatch, POLL_INTERVAL_MS);
}

export async function stopOutboxWorker() {
  if (timer) clearInterval(timer);
  // Wait for current batch to finish
  const deadline = Date.now() + 5_000;
  while (running && Date.now() < deadline) {
    await sleep(100);
  }
}

async function processBatch() {
  if (running) return;
  running = true;
  try {
    const rows = await db.eventOutbox.findMany({
      where: { status: 'pending', attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    for (const row of rows) {
      try {
        const ch = await getChannel();
        const payload = Buffer.from(JSON.stringify(row.payload));
        await new Promise<void>((resolve, reject) => {
          ch.publish(EXCHANGE, row.routingKey, payload, { persistent: true, messageId: row.id }, (err: any) => {
            if (err) reject(err); else resolve();
          });
        });
        await db.eventOutbox.update({
          where: { id: row.id },
          data: { status: 'published', publishedAt: new Date() },
        });
      } catch (err) {
        const attempts = row.attempts + 1;
        await db.eventOutbox.update({
          where: { id: row.id },
          data: {
            attempts,
            lastError: String(err),
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          },
        });
      }
    }

    // Purge old published events to prevent unbounded table growth
    await purgeStaleEvents();
  } finally {
    running = false;
  }
}

// Delete published events beyond the retention window. Runs each poll cycle.
// EVENT_RETENTION_DAYS=0 disables purge entirely.
async function purgeStaleEvents() {
  if (config.EVENT_RETENTION_DAYS <= 0) return;
  const cutoff = new Date(Date.now() - config.EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.eventOutbox.deleteMany({
    where: { status: 'published', publishedAt: { lt: cutoff } },
  });
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
