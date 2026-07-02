import type { AnyTradingEvent } from "@sentinel-nexus/contracts";

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return value;
  }

  seen.add(objectValue);

  for (const nestedValue of Object.values(objectValue as Record<string, unknown>)) {
    deepFreeze(nestedValue, seen);
  }

  return Object.freeze(objectValue) as T;
}

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

    const snapshot = deepFreeze(deepClone(event));

    this.events.push(snapshot);
    this.eventIds.add(snapshot.id);

    if (snapshot.idempotencyKey !== null) {
      this.idempotencyKeys.add(snapshot.idempotencyKey);
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
