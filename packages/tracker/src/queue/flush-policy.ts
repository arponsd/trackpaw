/** Flush policy configuration */
export interface FlushPolicy {
  /** Flush every N milliseconds */
  interval: number;
  /** Flush when queue reaches N events */
  queueSize: number;
  /** Flush on page unload */
  onUnload: boolean;
}

export function createFlushPolicy(
  interval: number,
  queueSize: number,
  onUnload: boolean = true,
): FlushPolicy {
  return { interval, queueSize, onUnload };
}
