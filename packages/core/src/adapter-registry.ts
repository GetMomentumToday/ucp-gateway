import type { PlatformAdapter } from './types/adapter.js';

/**
 * Registry for platform adapters.
 * Maintains a map of platform name → adapter instance.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, PlatformAdapter>();

  register(platform: string, adapter: PlatformAdapter): void {
    if (this.adapters.has(platform)) {
      throw new Error(`Adapter already registered for platform: ${platform}`);
    }
    this.adapters.set(platform, adapter);
  }

  get(platform: string): PlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${platform}`);
    }
    return adapter;
  }

  has(platform: string): boolean {
    return this.adapters.has(platform);
  }

  get platforms(): readonly string[] {
    return [...this.adapters.keys()];
  }
}
