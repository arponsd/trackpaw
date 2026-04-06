import type { AnalyticsQuery, DateRange } from '@trackpaw/types';

export interface QueryValidationResult {
  valid: boolean;
  error?: string;
}

const VALID_FILTER_OPERATORS = [
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
  'contains', 'not_contains', 'is_set', 'is_not_set', 'in', 'not_in',
];

export class QueryValidator {
  validate(query: AnalyticsQuery): QueryValidationResult {
    switch (query.type) {
      case 'trends': return this.validateTrends(query);
      case 'funnel': return this.validateFunnel(query);
      case 'retention': return this.validateRetention(query);
      case 'event_stream': return this.validateEventStream(query);
      case 'user_list': return this.validateUserList(query);
      case 'segment': return this.validateSegment(query);
      default:
        return { valid: false, error: `Unknown query type: ${(query as any).type}` };
    }
  }

  private validateTrends(query: any): QueryValidationResult {
    if (!query.events?.length) {
      return { valid: false, error: 'At least one event is required' };
    }
    if (!query.interval) {
      return { valid: false, error: 'Interval is required' };
    }
    if (!['hour', 'day', 'week', 'month'].includes(query.interval)) {
      return { valid: false, error: `Invalid interval: ${query.interval}` };
    }
    return this.validateDateRange(query.dateRange);
  }

  private validateFunnel(query: any): QueryValidationResult {
    if (!query.steps?.length || query.steps.length < 2) {
      return { valid: false, error: 'Funnel requires at least 2 steps' };
    }
    if (query.steps.length > 10) {
      return { valid: false, error: 'Funnel cannot have more than 10 steps' };
    }
    return this.validateDateRange(query.dateRange);
  }

  private validateRetention(query: any): QueryValidationResult {
    if (!query.startEvent) {
      return { valid: false, error: 'startEvent is required' };
    }
    if (!query.returnEvent) {
      return { valid: false, error: 'returnEvent is required' };
    }
    if (!query.periods || query.periods < 1 || query.periods > 52) {
      return { valid: false, error: 'Periods must be between 1 and 52' };
    }
    if (!['day', 'week', 'month'].includes(query.interval)) {
      return { valid: false, error: `Invalid interval: ${query.interval}` };
    }
    return this.validateDateRange(query.dateRange);
  }

  private validateEventStream(query: any): QueryValidationResult {
    if (query.limit !== undefined && (query.limit < 1 || query.limit > 10000)) {
      return { valid: false, error: 'Limit must be between 1 and 10,000' };
    }
    return { valid: true };
  }

  private validateUserList(query: any): QueryValidationResult {
    if (query.limit !== undefined && (query.limit < 1 || query.limit > 10000)) {
      return { valid: false, error: 'Limit must be between 1 and 10,000' };
    }
    return { valid: true };
  }

  private validateSegment(query: any): QueryValidationResult {
    if (!query.conditions?.length) {
      return { valid: false, error: 'At least one condition is required' };
    }
    if (!['and', 'or'].includes(query.combinator)) {
      return { valid: false, error: `Invalid combinator: ${query.combinator}` };
    }
    return { valid: true };
  }

  private validateDateRange(range?: DateRange): QueryValidationResult {
    if (!range) {
      return { valid: false, error: 'dateRange is required' };
    }

    if (range.preset) {
      if (!['24h', '7d', '14d', '30d', '90d', '365d'].includes(range.preset)) {
        return { valid: false, error: `Invalid date range preset: ${range.preset}` };
      }
      return { valid: true };
    }

    if (range.start && range.end) {
      const startMs = new Date(range.start).getTime();
      const endMs = new Date(range.end).getTime();

      if (isNaN(startMs) || isNaN(endMs)) {
        return { valid: false, error: 'Invalid date format in dateRange' };
      }
      if (endMs <= startMs) {
        return { valid: false, error: 'dateRange end must be after start' };
      }

      const daysDiff = (endMs - startMs) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        return { valid: false, error: 'Date range cannot exceed 365 days' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'dateRange must have either a preset or start/end' };
  }
}
