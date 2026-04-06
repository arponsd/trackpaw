import { createHash } from 'crypto';

export type PIIAction = 'hash' | 'remove';

export class PIIScrubber {
  constructor(
    private fields: string[],
    private action: PIIAction,
  ) {}

  scrub(properties: Record<string, any>): Record<string, any> {
    if (this.fields.length === 0) return properties;

    const result = { ...properties };

    for (const field of this.fields) {
      if (field in result) {
        if (this.action === 'remove') {
          delete result[field];
        } else {
          const value = String(result[field]);
          result[field] = `sha256:${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
        }
      }
    }

    return result;
  }
}
