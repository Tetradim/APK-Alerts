import type { AnyTradingEvent } from "@apk-alerts/contracts";

export class DuplicateEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateEventError";
  }
}

export class UnknownCursorError extends Error {
  constructor(cursor: string) {
    super(`Unknown event cursor: ${cursor}`);
    this.name = "UnknownCursorError";
  }
}

export class InMemoryEventLog {
  private readonly events: AnyTradingEvent[] = [];
  private readonly eventIds = new Set<string>();
  private readonly idempotencyKeys = new Set<string>();

  append(event: AnyTradingEvent): void {
    if (this.eventIds.has(event.id)) {
      throw new DuplicateEventError(`Duplicate event id: ${event.id}`);
    }

    if (event.idempotencyKey !== null && this.idempotencyKeys.has(event.idempotencyKey)) {
      throw new DuplicateEventError(`Duplicate idempotency key: ${event.idempotencyKey}`);
    }

    this.events.push(event);
    this.eventIds.add(event.id);

    if (event.idempotencyKey !== null) {
      this.idempotencyKeys.add(event.idempotencyKey);
    }
  }

  readAfter(cursor: string | null): AnyTradingEvent[] {
    if (cursor === null) {
      return [...this.events];
    }

    const cursorIndex = this.events.findIndex((event) => event.id === cursor);

    if (cursorIndex === -1) {
      throw new UnknownCursorError(cursor);
    }

    return this.events.slice(cursorIndex + 1);
  }

  latestCursor(): string | null {
    return this.events.at(-1)?.id ?? null;
  }

  size(): number {
    return this.events.length;
  }
}
