import amqplib, { type ConfirmChannel } from 'amqplib';
import { config } from '../config/env.js';

// §1.5 — reconnection manager with exponential backoff + jitter
// Route handlers / outbox worker call getChannel() — never hold a reference directly
const EXCHANGE = 'iris.events';
const MAX_BACKOFF_MS = 30_000;

type State = 'connected' | 'reconnecting' | 'disconnected';

let conn: any = null;
let channel: ConfirmChannel | null = null;
let state: State = 'disconnected';
let reconnectAttempt = 0;
let shuttingDown = false;

export function getBrokerState(): State {
  return state;
}

export async function getChannel(): Promise<ConfirmChannel> {
  if (channel) return channel;
  // Wait up to 5s for reconnection in flight
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (channel) return channel;
    await sleep(100);
  }
  throw new Error('AMQP channel unavailable');
}

async function connect() {
  try {
    conn = await amqplib.connect(config.RABBITMQ_URL);
    channel = await conn.createConfirmChannel();
    await channel!.assertExchange(EXCHANGE, 'topic', { durable: true });
    state = 'connected';
    reconnectAttempt = 0;

    conn.on('error', () => scheduleReconnect());
    conn.on('close', () => { if (!shuttingDown) scheduleReconnect(); });
  } catch (err) {
    state = 'reconnecting';
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  channel = null;
  conn = null;
  state = 'reconnecting';
  reconnectAttempt++;
  // Exponential backoff + jitter
  const base = Math.min(500 * 2 ** reconnectAttempt, MAX_BACKOFF_MS);
  const delay = base * (0.5 + Math.random() * 0.5);
  setTimeout(() => connect(), delay);
}

export async function connectBroker() {
  await connect();
}

export async function closeBroker() {
  shuttingDown = true;
  try {
    await channel?.close();
    await conn?.close();
  } catch { /* best-effort */ }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
