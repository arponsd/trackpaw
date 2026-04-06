/**
 * Anonymize IP addresses by zeroing the last octet (IPv4) or last 80 bits (IPv6).
 *
 * IPv4: 192.168.1.234 → 192.168.1.0
 * IPv6: 2001:0db8:85a3::8a2e:0370:7334 → 2001:0db8:85a3::0:0:0
 */
export function anonymizeIP(ip: string): string {
  if (!ip) return ip;

  // IPv4
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[3] = '0';
      return parts.join('.');
    }
    return ip;
  }

  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    // Zero out last 5 groups (80 bits)
    const keep = Math.max(parts.length - 5, 1);
    return parts.slice(0, keep).concat(Array(parts.length - keep).fill('0')).join(':');
  }

  return ip;
}
