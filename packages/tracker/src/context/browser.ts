interface BrowserInfo {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

let cached: BrowserInfo | null = null;

export function detectBrowser(): BrowserInfo {
  if (cached) return cached;
  if (typeof navigator === 'undefined') {
    return { browser: '', browserVersion: '', os: '', osVersion: '', deviceType: 'desktop' };
  }

  const ua = navigator.userAgent;
  cached = {
    browser: parseBrowser(ua),
    browserVersion: parseVersion(ua),
    os: parseOS(ua),
    osVersion: parseOSVer(ua),
    deviceType: /iPad|tablet/i.test(ua)
      ? 'tablet'
      : /Mobile|iPhone|iPod|Android.*Mobile/i.test(ua)
        ? 'mobile'
        : 'desktop',
  };
  return cached;
}

function parseBrowser(ua: string): string {
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/')) return 'Opera';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  return '';
}

function parseVersion(ua: string): string {
  const m =
    ua.match(/(?:Firefox|Edg|OPR|Chrome)\/(\d+(?:\.\d+)*)/) || ua.match(/Version\/(\d+(?:\.\d+)*)/);
  return m?.[1] ?? '';
}

function parseOS(ua: string): string {
  if (ua.includes('Windows')) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return '';
}

function parseOSVer(ua: string): string {
  const m =
    ua.match(/Windows NT (\d+[\d.]*)/) ||
    ua.match(/Mac OS X (\d+[_\d.]*)/) ||
    ua.match(/Android (\d+[\d.]*)/) ||
    ua.match(/OS (\d+[_\d]*)/);
  return m?.[1]?.replace(/_/g, '.') ?? '';
}

export function getScreenDimensions(): { width: number; height: number } {
  if (typeof screen === 'undefined') return { width: 0, height: 0 };
  return { width: screen.width, height: screen.height };
}

export function getLocale(): string {
  return typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
}

export function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}
