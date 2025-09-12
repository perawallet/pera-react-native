import { vi } from "vitest";

// Silence RN Animated warnings
vi.mock("react-native/Libraries/Animated/NativeAnimatedHelper", () => ({}));

// Basic NativeEventEmitter dependency to avoid errors when no native module is provided
vi.mock("react-native/Libraries/EventEmitter/NativeEventEmitter", () => {
  return class NativeEventEmitter {};
});

// Common native modules used in the app, stubbed with minimal implementations
vi.mock("@react-native-firebase/app", () => ({
  default: { app: vi.fn(() => ({})) }
}));

vi.mock("@react-native-firebase/crashlytics", () => ({
  default: () => ({ recordError: vi.fn(), log: vi.fn() })
}));

vi.mock("@react-native-firebase/messaging", () => ({
  default: () => ({ onMessage: vi.fn(() => vi.fn()), getToken: vi.fn(async () => "token") })
}));

vi.mock("@react-native-firebase/remote-config", () => ({
  default: () => ({
    setDefaults: vi.fn(async () => {}),
    fetchAndActivate: vi.fn(async () => true),
    getValue: vi.fn(() => ({ asString: () => "", asBoolean: () => false, asNumber: () => 0 }))
  })
}));

vi.mock("@notifee/react-native", () => ({
  default: { requestPermission: vi.fn(async () => true), onForegroundEvent: vi.fn(() => vi.fn()) }
}));

vi.mock("react-native-keychain", () => ({
  setGenericPassword: vi.fn(async () => true),
  getGenericPassword: vi.fn(async () => false),
  resetGenericPassword: vi.fn(async () => true)
}));

vi.mock("react-native-mmkv", () => {
  class MMKV {
    private store = new Map<string, string>();
    getString(key: string) { return this.store.get(key) ?? null; }
    set(key: string, value: string) { this.store.set(key, String(value)); }
    delete(key: string) { this.store.delete(key); }
  }
  return { MMKV };
});