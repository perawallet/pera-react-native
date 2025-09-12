import { describe, test, expect, vi } from "vitest";
import { registerPlatformServices } from "../../platform";
import { Networks } from "../../services/blockchain/types";
import type { KeyValueStorageService } from "../../services/storage/key-value-storage";
import type { SecureStorageService } from "../../services/storage/secure-storage";
import type { RemoteConfigService } from "../../services/configuration/remote-config";
import type { NotificationService, NotificationsInitResult } from "../../services/configuration/notifications";
import type { CrashReportingService } from "../../services/configuration/reporting";

class MemoryKeyValueStorage implements KeyValueStorageService {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setJSON<T>(key: string, value: T): void {
    this.setItem(key, JSON.stringify(value));
  }

  getJSON<T>(key: string): T | null {
    const v = this.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  }
}

const dummySecure: SecureStorageService = {
  async setItem() {},
  async getItem() { return null; },
  async removeItem() {},
  async authenticate() { return true; }
};

const dummyRemote: RemoteConfigService = {
  initializeRemoteConfig() {},
  getStringValue(_k, f) { return f ?? ""; },
  getBooleanValue(_k, f) { return f ?? false; },
  getNumberValue(_k, f) { return f ?? 0; }
};

const dummyNotif: NotificationService = {
  async initializeNotifications(): Promise<NotificationsInitResult> {
    return { unsubscribe: () => {} };
  }
};

const dummyCrash: CrashReportingService = {
  initializeCrashReporting() {},
  recordNonFatalError(_e: unknown) {}
};

describe("store/app-store", () => {
  test("initializes defaults, updates, and persists selected keys", async () => {
    const kv = new MemoryKeyValueStorage();

    // Register platform services so app-store persist() can resolve storage via the container
    registerPlatformServices({
      keyValueStorage: kv,
      secureStorage: dummySecure,
      remoteConfig: dummyRemote,
      notification: dummyNotif,
      crashReporting: dummyCrash
    });

    // First load: verify defaults and update values
    vi.resetModules();
    {
      const { useAppStore } = await import("../app-store");
      const state = useAppStore.getState();

      expect(state.theme).toBe("system");
      expect(state.fcmToken).toBeNull();
      expect(state.network).toBe(Networks.mainnet);

      state.setTheme("dark");
      state.setFcmToken("abc");
      state.setNetwork(Networks.testnet);
    }

    // Second load (fresh module context): verify rehydration from persisted storage
    vi.resetModules();
    {
      const { useAppStore } = await import("../app-store");
      const rehydrated = useAppStore.getState();

      expect(rehydrated.theme).toBe("dark");
      expect(rehydrated.fcmToken).toBe("abc");
      expect(rehydrated.network).toBe(Networks.testnet);
    }
  });
});