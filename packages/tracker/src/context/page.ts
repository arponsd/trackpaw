export interface PageInfo {
  url: string;
  path: string;
  title: string;
  referrer: string;
}

export function getPageInfo(): PageInfo {
  if (typeof document === 'undefined' || typeof location === 'undefined') {
    return { url: '', path: '', title: '', referrer: '' };
  }

  return {
    url: location.href,
    path: location.pathname,
    title: document.title,
    referrer: document.referrer,
  };
}
