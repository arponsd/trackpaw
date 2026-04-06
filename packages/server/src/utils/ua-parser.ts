export interface ParsedUA {
  browser: string | null;
  os: string | null;
  deviceType: string | null;
}

export function parseUserAgent(ua: string): ParsedUA {
  if (!ua) return { browser: null, os: null, deviceType: null };

  return {
    browser: parseBrowser(ua),
    os: parseOS(ua),
    deviceType: parseDevice(ua),
  };
}

function parseBrowser(ua: string): string {
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/')) return 'Opera';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  return 'Other';
}

function parseOS(ua: string): string {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Windows')) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Other';
}

function parseDevice(ua: string): string {
  if (/iPad|tablet/i.test(ua)) return 'tablet';
  if (/Mobile|iPhone|iPod|Android.*Mobile/i.test(ua)) return 'mobile';
  return 'desktop';
}
