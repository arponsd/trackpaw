import { type TrackerInitConfig, type ResolvedConfig, resolveConfig } from './config';
import { SDK_NAME, SDK_VERSION, STORAGE_KEYS } from './constants';
import { IdentityManager } from '../identity/identity';
import { ConsentManager } from '../consent/consent';
import { EventQueue } from '../queue/event-queue';
import { SafeStorage, SafeSessionStorage } from '../utils/storage';
import { now, nowMs } from '../utils/time';
import { detectBrowser, getScreenDimensions, getLocale, getTimezone } from '../context/browser';
import { getPageInfo } from '../context/page';
import { extractUTM } from '../context/utm';
import { PageViewCapture } from '../auto-capture/page-view';
import { ClickCapture } from '../auto-capture/click';
import { FormCapture } from '../auto-capture/form';

export class Trackpaw {
  static readonly version = SDK_VERSION;

  private config: ResolvedConfig;
  private identity: IdentityManager;
  private consent: ConsentManager;
  private queue: EventQueue;
  private storage: SafeStorage;

  private superProperties: Record<string, any> = {};
  private setOnceProperties: Record<string, any> = {};
  private timedEvents: Map<string, number> = new Map();

  // Auto-capture modules
  private pageViewCapture: PageViewCapture | null = null;
  private clickCapture: ClickCapture | null = null;
  private formCapture: FormCapture | null = null;

  private constructor(config: ResolvedConfig) {
    this.config = config;

    // Use memory-only storage if persistence is 'memory'
    this.storage =
      config.persistence === 'memory'
        ? new SafeStorage('__it_memory_') // will use memory fallback since prefix is unusual
        : new SafeStorage(config.persistencePrefix);

    const sessionStore = new SafeSessionStorage(config.persistencePrefix);

    this.identity = new IdentityManager(this.storage, sessionStore, config.sessionTimeout);
    this.consent = new ConsentManager(this.storage, config.defaultOptOut, config.respectDoNotTrack);
    this.queue = new EventQueue(config);

    // Restore super properties
    const storedSuper = this.storage.get(STORAGE_KEYS.SUPER_PROPERTIES);
    if (storedSuper) {
      try {
        this.superProperties = JSON.parse(storedSuper);
      } catch {
        // ignore
      }
    }

    // Restore set-once properties
    const storedOnce = this.storage.get(STORAGE_KEYS.SET_ONCE_PROPERTIES);
    if (storedOnce) {
      try {
        this.setOnceProperties = JSON.parse(storedOnce);
      } catch {
        // ignore
      }
    }

    // Start auto-capture
    this.initAutoCapture();
  }

  /** Initialize the tracker */
  static init(config: TrackerInitConfig): Trackpaw {
    const resolved = resolveConfig(config);
    return new Trackpaw(resolved);
  }

  // ─── Core Methods ──────────────────────────────────────────────

  /** Track a custom event */
  track(eventName: string, properties?: Record<string, any>): void {
    if (this.consent.hasOptedOut()) return;

    const props = { ...properties };

    // Add timed event duration if applicable
    const startTime = this.timedEvents.get(eventName);
    if (startTime !== undefined) {
      props.$duration = (nowMs() - startTime) / 1000;
      this.timedEvents.delete(eventName);
    }

    this.enqueueEvent(eventName, props);
  }

  /** Track a page view */
  page(pageName?: string, properties?: Record<string, any>): void {
    if (this.consent.hasOptedOut()) return;

    const pageInfo = getPageInfo();
    const name = pageName || pageInfo.path || '$pageview';

    this.enqueueEvent('$pageview', {
      name,
      ...pageInfo,
      ...properties,
    });
  }

  /** Identify a user */
  identify(userId: string, traits?: Record<string, any>): void {
    if (this.consent.hasOptedOut()) return;

    this.identity.identify(userId, traits);

    this.enqueueEvent('$identify', {
      userId,
      traits: traits || {},
    });
  }

  /** Set user traits without triggering an identify event */
  setUserProperties(traits: Record<string, any>): void {
    this.identity.setTraits(traits);
  }

  /** Set properties that persist across all future events */
  setSuperProperties(properties: Record<string, any>): void {
    this.superProperties = { ...this.superProperties, ...properties };
    this.storage.set(STORAGE_KEYS.SUPER_PROPERTIES, JSON.stringify(this.superProperties));
  }

  /** Remove specific super properties */
  unsetSuperProperties(keys: string[]): void {
    for (const key of keys) {
      delete this.superProperties[key];
    }
    this.storage.set(STORAGE_KEYS.SUPER_PROPERTIES, JSON.stringify(this.superProperties));
  }

  /** Register a one-time property (set once, never overwritten) */
  setOnce(properties: Record<string, any>): void {
    for (const [key, value] of Object.entries(properties)) {
      if (!(key in this.setOnceProperties)) {
        this.setOnceProperties[key] = value;
      }
    }
    this.storage.set(STORAGE_KEYS.SET_ONCE_PROPERTIES, JSON.stringify(this.setOnceProperties));
  }

  /** Start a timed event — call track() later to complete it with duration */
  timeEvent(eventName: string): void {
    this.timedEvents.set(eventName, nowMs());
  }

  /** Add the user to a group */
  group(groupType: string, groupId: string, traits?: Record<string, any>): void {
    if (this.consent.hasOptedOut()) return;

    this.enqueueEvent('$group', {
      groupType,
      groupId,
      traits: traits || {},
    });
  }

  // ─── Consent ───────────────────────────────────────────────────

  optOut(): void {
    this.consent.optOut();
  }

  optIn(): void {
    this.consent.optIn();
  }

  hasOptedOut(): boolean {
    return this.consent.hasOptedOut();
  }

  // ─── Identity Getters ──────────────────────────────────────────

  getAnonymousId(): string {
    return this.identity.getAnonymousId();
  }

  getUserId(): string | null {
    return this.identity.getUserId();
  }

  getSessionId(): string {
    return this.identity.getSessionId();
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  /** Clear all local data and reset identity */
  reset(): void {
    this.identity.reset();
    this.superProperties = {};
    this.setOnceProperties = {};
    this.timedEvents.clear();
    this.storage.remove(STORAGE_KEYS.SUPER_PROPERTIES);
    this.storage.remove(STORAGE_KEYS.SET_ONCE_PROPERTIES);
    this.storage.clear();
  }

  /** Force flush the event queue */
  async flush(): Promise<void> {
    await this.queue.flush();
  }

  /** Shut down the tracker (flush + stop timers + stop auto-capture) */
  async shutdown(): Promise<void> {
    this.stopAutoCapture();
    await this.queue.shutdown();
  }

  // ─── Internal ──────────────────────────────────────────────────

  private enqueueEvent(eventName: string, properties: Record<string, any>): void {
    this.identity.touch();

    const browserInfo = detectBrowser();
    const screenDims = getScreenDimensions();
    const pageInfo = getPageInfo();
    const utmParams = extractUTM();

    const event = {
      event: eventName,
      properties: {
        ...this.config.defaultProperties,
        ...this.setOnceProperties,
        ...this.superProperties,
        ...properties,
      },
      timestamp: now(),
      userId: this.identity.getUserId(),
      anonymousId: this.identity.getAnonymousId(),
      sessionId: this.identity.getSessionId(),
      context: {
        page: pageInfo,
        browser: browserInfo.browser,
        browserVersion: browserInfo.browserVersion,
        os: browserInfo.os,
        osVersion: browserInfo.osVersion,
        deviceType: browserInfo.deviceType,
        screenWidth: screenDims.width,
        screenHeight: screenDims.height,
        locale: getLocale(),
        timezone: getTimezone(),
        utm: utmParams,
      },
      sdk: {
        name: SDK_NAME,
        version: SDK_VERSION,
      },
      superProperties: { ...this.superProperties },
      _metadata: {
        sentAt: '', // filled by transport
        ipAnonymization: this.config.ipAnonymization,
      },
    };

    if (this.config.debug) {
      console.log('[Trackpaw]', eventName, event);
    }

    this.queue.add(event);
  }

  private initAutoCapture(): void {
    if (this.config.autoTrack.pageViews) {
      this.pageViewCapture = new PageViewCapture((name, props) => this.page(name, props));
      this.pageViewCapture.start();
    }

    if (this.config.autoTrack.clicks) {
      this.clickCapture = new ClickCapture((name, props) => this.track(name, props));
      this.clickCapture.start();
    }

    if (this.config.autoTrack.forms) {
      this.formCapture = new FormCapture((name, props) => this.track(name, props));
      this.formCapture.start();
    }
  }

  private stopAutoCapture(): void {
    this.pageViewCapture?.stop();
    this.clickCapture?.stop();
    this.formCapture?.stop();
  }
}
