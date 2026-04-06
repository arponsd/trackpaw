export interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

const UTM_MAP: Record<string, keyof UTMParams> = {
  utm_source: 'source',
  utm_medium: 'medium',
  utm_campaign: 'campaign',
  utm_term: 'term',
  utm_content: 'content',
};

export function extractUTM(): UTMParams {
  if (typeof location === 'undefined') return {};

  const params: UTMParams = {};

  try {
    const searchParams = new URLSearchParams(location.search);
    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        params[UTM_MAP[key]!] = value;
      }
    }
  } catch {
    // URLSearchParams not available
  }

  return params;
}
