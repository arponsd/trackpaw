import type { StorageAdapter } from '../adapters/types';

export class IdentityResolver {
  constructor(private adapter: StorageAdapter) {}

  async resolve(
    userId: string,
    traits: Record<string, any>,
    anonymousId: string,
  ): Promise<{ isNewUser: boolean }> {
    const existing = await this.adapter.getUserProfile(userId);
    await this.adapter.upsertUser(userId, traits, anonymousId);
    return { isNewUser: !existing };
  }
}
