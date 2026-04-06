/** Return current time as ISO 8601 string */
export function now(): string {
  return new Date().toISOString();
}

/** Return current time as unix timestamp in milliseconds */
export function nowMs(): number {
  return Date.now();
}
