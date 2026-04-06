import type { RawEvent } from '@trackpaw/types';

export interface ValidationConfig {
  maxEventNameLength: number;
  maxPropertiesCount: number;
  maxPropertyValueLength: number;
  allowedEventNames?: string[];
  blockedEventNames?: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const DEFAULT_CONFIG: ValidationConfig = {
  maxEventNameLength: 256,
  maxPropertiesCount: 50,
  maxPropertyValueLength: 8192,
};

export class EventValidator {
  private config: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  validate(event: RawEvent): ValidationResult {
    if (!event.event || typeof event.event !== 'string') {
      return { valid: false, error: 'Event name is required' };
    }

    if (event.event.length > this.config.maxEventNameLength) {
      return { valid: false, error: `Event name exceeds ${this.config.maxEventNameLength} characters` };
    }

    if (!event.anonymousId) {
      return { valid: false, error: 'anonymousId is required' };
    }

    if (!event.sessionId) {
      return { valid: false, error: 'sessionId is required' };
    }

    if (!event.timestamp) {
      return { valid: false, error: 'timestamp is required' };
    }

    // Check properties count
    if (event.properties) {
      const keys = Object.keys(event.properties);
      if (keys.length > this.config.maxPropertiesCount) {
        return { valid: false, error: `Properties count exceeds ${this.config.maxPropertiesCount}` };
      }

      // Check property value sizes
      for (const [key, value] of Object.entries(event.properties)) {
        if (typeof value === 'string' && value.length > this.config.maxPropertyValueLength) {
          return {
            valid: false,
            error: `Property "${key}" value exceeds ${this.config.maxPropertyValueLength} characters`,
          };
        }
      }
    }

    // Allowed/blocked event names
    if (this.config.allowedEventNames?.length) {
      if (!this.config.allowedEventNames.includes(event.event)) {
        return { valid: false, error: `Event "${event.event}" is not in the allowed list` };
      }
    }

    if (this.config.blockedEventNames?.length) {
      if (this.config.blockedEventNames.includes(event.event)) {
        return { valid: false, error: `Event "${event.event}" is blocked` };
      }
    }

    return { valid: true };
  }
}
