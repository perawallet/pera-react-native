import 'reflect-metadata';
import { vi, afterEach } from 'vitest';

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Mock React Native core modules
vi.mock('react-native', async () => {
  const RN = await vi.importActual('react-native');
  return {
    ...RN,
    Platform: {
      OS: 'ios',
      select: vi.fn((obj) => obj.ios || obj.default),
    },
    Dimensions: {
      get: vi.fn(() => ({ width: 375, height: 812 })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    StatusBar: {
      setBarStyle: vi.fn(),
      setBackgroundColor: vi.fn(),
    },
    Alert: {
      alert: vi.fn(),
    },
    StyleSheet: {
      create: vi.fn((styles) => styles),
      hairlineWidth: 1,
      absoluteFill: { position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 },
    },
    TouchableOpacity: vi.fn().mockImplementation(({ children, ...props }) => children),
    View: vi.fn().mockImplementation(({ children, ...props }) => children),
    Text: vi.fn().mockImplementation(({ children, ...props }) => children),
  };
});

// Silence RN Animated warnings
vi.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));

// Basic NativeEventEmitter dependency to avoid errors when no native module is provided
vi.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return class NativeEventEmitter {};
});

// Mock React Navigation
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
    reset: vi.fn(),
    setOptions: vi.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: vi.fn(),
  NavigationContainer: ({ children }: any) => children,
}));

vi.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: vi.fn(() => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => children,
  })),
}));

vi.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: vi.fn(() => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => children,
  })),
}));

// Common native modules used in the app, stubbed with minimal implementations
vi.mock('@react-native-firebase/app', () => ({
  default: { app: vi.fn(() => ({})) },
}));

vi.mock('@react-native-firebase/crashlytics', () => ({
  default: () => ({ recordError: vi.fn(), log: vi.fn() }),
}));

vi.mock('@react-native-firebase/messaging', () => ({
  default: () => ({
    onMessage: vi.fn(() => vi.fn()),
    getToken: vi.fn(async () => 'token'),
  }),
}));

vi.mock('@react-native-firebase/remote-config', () => ({
  default: () => ({
    setDefaults: vi.fn(async () => {}),
    fetchAndActivate: vi.fn(async () => true),
    getValue: vi.fn(() => ({
      asString: () => '',
      asBoolean: () => false,
      asNumber: () => 0,
    })),
  }),
}));

vi.mock('@notifee/react-native', () => ({
  default: {
    requestPermission: vi.fn(async () => true),
    onForegroundEvent: vi.fn(() => vi.fn()),
  },
}));

vi.mock('react-native-keychain', () => ({
  setGenericPassword: vi.fn(async () => true),
  getGenericPassword: vi.fn(async () => false),
  resetGenericPassword: vi.fn(async () => true),
}));

vi.mock('react-native-mmkv', () => {
  class MMKV {
    private store = new Map<string, string>();
    getString(key: string) {
      return this.store.get(key) ?? null;
    }
    set(key: string, value: string) {
      this.store.set(key, String(value));
    }
    delete(key: string) {
      this.store.delete(key);
    }
  }
  return { MMKV };
});
