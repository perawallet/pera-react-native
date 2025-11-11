/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import 'reflect-metadata';
import { vi, afterEach } from 'vitest';

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

vi.mock('react-native-device-info', () => ({
  default: {
    getApplicationName: () => 'Test App',
    getBundleId: () => 'com.test.app',
    getVersion: () => '1.0.0',
    getSystemVersion: () => '17.0',
    getDeviceId: () => 'test-device',
    getUniqueId: () => Promise.resolve('unique-id'),
    getModel: () => 'iPhone',
  },
}));

vi.mock('react-native-keychain', () => ({
  setGenericPassword: vi.fn().mockResolvedValue(true),
  getGenericPassword: vi.fn().mockResolvedValue({
    username: 'user',
    password: 'test-password',
  }),
  resetGenericPassword: vi.fn().mockResolvedValue(true),
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
  },
  SECURITY_LEVEL: {
    SECURE_HARDWARE: 'SecureHardware',
  },
}));

// // Mock React Native core modules
vi.mock('react-native', async () => {
  const RN = await vi.importActual('react-native');
  return {
    ...RN,
    Platform: {
      OS: 'ios',
      select: vi.fn(obj => obj.ios || obj.default),
    },
    NativeModules: {
      SettingsManager: {
        settings: {
          AppleLocale: 'en_US',
          AppleLanguages: ['en_US', 'fr_FR'],
        },
      },
      I18nManager: {
        getConstants: vi.fn(() => ({
          localeIdentifier: 'en_US',
        })),
      },
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
      create: vi.fn(styles => styles),
      hairlineWidth: 1,
      absoluteFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      },
    },
    TouchableOpacity: vi.fn().mockImplementation(({ children }) => children),
    View: vi.fn().mockImplementation(({ children }) => children),
    Text: vi.fn().mockImplementation(({ children }) => children),
  };
});

vi.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: vi.fn().mockImplementation(({ children }) => children),
    SafeAreaConsumer: vi
      .fn()
      .mockImplementation(({ children }) => children(inset)),
    useSafeAreaInsets: vi.fn().mockImplementation(() => inset),
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
  getCrashlytics: () => ({
    setCrashlyticsCollectionEnabled: vi.fn(),
    recordError: vi.fn(),
    log: vi.fn(),
  }),
}));

vi.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({
    registerDeviceForRemoteMessages: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
    getToken: vi.fn(async () => 'token'),
  }),
}));

vi.mock('@react-native-firebase/remote-config', () => ({
  getRemoteConfig: () => ({
    setDefaults: vi.fn(async () => {}),
    fetchAndActivate: vi.fn(async () => true),
    setConfigSettings: vi.fn(),
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

vi.mock('@notifee/react-native', () => {
  return {
    AuthorizationStatus: 'AUTHORIZED',
    notifee: {
      requestPermission: vi.fn(),
      createChannel: vi.fn(),
      displayNotification: vi.fn(),
      onForegroundEvent: vi.fn(),
    },
  };
});
