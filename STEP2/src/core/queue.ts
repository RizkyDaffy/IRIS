import type { PublishPayload, PublishResult } from './types.js';

interface QueueItem {
  payload: PublishPayload<unknown>;
  resolve: (res: PublishResult) => void;
}

export class BoundedQueue {
  private queue: QueueItem[] = [];
  private maxSize: number;
  private policy: 'drop-oldest' | 'reject-newest';

  constructor(maxSize: number, policy: 'drop-oldest' | 'reject-newest') {
    this.maxSize = maxSize;
    this.policy = policy;
  }

  enqueue(item: QueueItem): 'queued' | 'dropped' {
    if (this.queue.length >= this.maxSize) {
      if (this.policy === 'reject-newest') {
        return 'dropped';
      } else {
        // drop-oldest
        const dropped = this.queue.shift();
        if (dropped) {
          dropped.resolve({ status: 'dropped', idempotencyKey: dropped.payload.idempotencyKey! });
        }
      }
    }
    this.queue.push(item);
    return 'queued';
  }

  dequeue(): QueueItem | undefined {
    return this.queue.shift();
  }

  get size() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
  }
}
