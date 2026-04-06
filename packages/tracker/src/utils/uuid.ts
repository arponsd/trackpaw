/**
 * Generate a UUID v4 string with zero dependencies.
 * Uses crypto.getRandomValues when available, falls back to Math.random.
 */
export function uuid(): string {
  const getRandomValues =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? (buf: Uint8Array) => crypto.getRandomValues(buf)
      : (buf: Uint8Array) => {
          for (let i = 0; i < buf.length; i++) {
            buf[i] = (Math.random() * 256) | 0;
          }
          return buf;
        };

  const bytes = getRandomValues(new Uint8Array(16));

  // Set version 4 (0100) in byte 6
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  // Set variant 10 in byte 8
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
