import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RNFirebaseService } from '../firebase';
import { AuthorizationStatus } from '@react-native-firebase/messaging';

// Mock react-native Platform
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: vi.fn(config => config.ios),
  },
}));

// Mock Firebase modules with simple implementations
vi.mock('@react-native-firebase/crashlytics', () => ({
  getCrashlytics: () => ({
    setCrashlyticsCollectionEnabled: vi.fn().mockResolvedValue(null),
    recordError: vi.fn(),
  }),
}));

const mockRemoteConfig = vi.hoisted(() => ({
  setConfigSettings: vi.fn().mockResolvedValue(undefined),
  setDefaults: vi.fn().mockResolvedValue(undefined),
  fetchAndActivate: vi.fn().mockResolvedValue(true),
  getValue: vi.fn(),
}));

vi.mock('@react-native-firebase/remote-config', () => ({
  getRemoteConfig: () => mockRemoteConfig,
}));

const mockMessaging = vi.hoisted(() => ({
  registerDeviceForRemoteMessages: vi.fn().mockResolvedValue(undefined),
  getToken: vi.fn().mockResolvedValue('mock-fcm-token'),
  onMessage: vi.fn(() => vi.fn()),
}));

vi.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => mockMessaging,
}));

const mockNotifee = vi.hoisted(() => ({
  requestPermission: vi.fn().mockResolvedValue(1),
  createChannel: vi.fn().mockResolvedValue(undefined),
  displayNotification: vi.fn().mockResolvedValue(undefined),
  onForegroundEvent: vi.fn(() => vi.fn()),
}));

vi.mock('@notifee/react-native', () => ({
  default: mockNotifee,
  AndroidImportance: {
    DEFAULT: 3,
  },
  EventType: {
    ACTION_PRESS: 1,
    PRESS: 0,
  },
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
}));

describe('RNFirebaseService', () => {
  let service: RNFirebaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RNFirebaseService();
  });

  describe('Remote Config', () => {
    describe('initializeRemoteConfig', () => {
      it('should initialize remote config successfully', async () => {
        await expect(service.initializeRemoteConfig()).resolves.not.toThrow();
      });

      it('should handle fetch errors gracefully', async () => {
        mockRemoteConfig.fetchAndActivate.mockRejectedValueOnce(
          new Error('Fetch failed'),
        );
        await expect(service.initializeRemoteConfig()).resolves.not.toThrow();
      });
    });

    describe('getStringValue', () => {
      it('should return string value from remote config', () => {
        mockRemoteConfig.getValue.mockReturnValueOnce({
          asString: () => 'mock-string-value',
          asBoolean: () => true,
          asNumber: () => 42,
        });
        const result = service.getStringValue('welcome_message');
        expect(result).toBe('mock-string-value');
      });

      it('should return fallback value when provided', () => {
        mockRemoteConfig.getValue.mockReturnValueOnce({
          asString: () => 'mock-string-value',
          asBoolean: () => true,
          asNumber: () => 42,
        });
        const result = service.getStringValue('welcome_message', 'fallback');
        expect(result).toBe('mock-string-value');
      });

      it('should return empty string when no fallback and getValue nothing', async () => {
        mockRemoteConfig.getValue.mockRejectedValue(new Error('no value'));
        const result = service.getStringValue('welcome_message');
        expect(result).toBe('');
      });
    });

    describe('getBooleanValue', () => {
      it('should return boolean value from remote config', () => {
        mockRemoteConfig.getValue.mockReturnValueOnce({
          asString: () => 'mock-string-value',
          asBoolean: () => true,
          asNumber: () => 42,
        });
        const result = service.getBooleanValue('welcome_message');
        expect(result).toEqual(true);
      });

      it('should return value even when fallback provided', () => {
        mockRemoteConfig.getValue.mockReturnValueOnce({
          asString: () => 'mock-string-value',
          asBoolean: () => true,
          asNumber: () => 42,
        });
        const result = service.getBooleanValue('welcome_message', false);
        expect(result).toEqual(true);
      });

      it('should return fallback ', async () => {
        mockRemoteConfig.getValue.mockRejectedValue(new Error('no value'));
        const result = service.getBooleanValue('welcome_message', true);
        expect(result).toEqual(true);
      });
    });

    describe('getNumberValue', () => {
      it('should return number value from remote config', () => {
        mockRemoteConfig.getValue.mockReturnValueOnce({
          asString: () => 'mock-string-value',
          asBoolean: () => true,
          asNumber: () => 42,
        });
        const result = service.getNumberValue('welcome_message');
        expect(result).toEqual(42);
      });

      it('should ignore fallback value when value received', () => {
        mockRemoteConfig.getValue.mockReturnValueOnce({
          asString: () => 'mock-string-value',
          asBoolean: () => true,
          asNumber: () => 42,
        });
        const result = service.getNumberValue('welcome_message', 100);
        expect(result).toEqual(42);
      });

      it('should return fallback value when no value received', () => {
        mockRemoteConfig.getValue.mockRejectedValue(new Error('no value'));
        const result = service.getNumberValue('welcome_message', 100);
        expect(result).toEqual(100);
      });
    });
  });

  describe('Notifications', () => {
    describe('initializeNotifications', () => {
      it('should initialize notifications successfully', async () => {
        mockNotifee.requestPermission.mockResolvedValue({
          authorizationStatus: 1, //AUTHORIZED
        });
        const result = await service.initializeNotifications();

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('unsubscribe');
        expect(typeof result.unsubscribe).toBe('function');
        expect(result.token).toEqual('mock-fcm-token');
      });

      it('should handle Android platform correctly', async () => {
        const { Platform } = await import('react-native');
        vi.mocked(Platform).OS = 'android';
        vi.mocked(Platform.select).mockImplementation(
          (config: any) => config.android,
        );
        mockNotifee.requestPermission.mockResolvedValue({
          authorizationStatus: 1,
        });

        const result = await service.initializeNotifications();

        expect(result.token).toEqual('mock-fcm-token');
        expect(typeof result.unsubscribe).toBe('function');
      });

      it('should call unsubscribe functions when unsubscribe is called', async () => {
        const result = await service.initializeNotifications();

        // Should not throw when calling unsubscribe
        expect(() => result.unsubscribe()).not.toThrow();
      });

      it('should handle permission request errors', async () => {
        mockNotifee.requestPermission.mockResolvedValue({
          authorizationStatus: 'DENIED',
        });

        const result = await service.initializeNotifications();

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('unsubscribe');
      });

      it('should handle messaging registration errors', async () => {
        mockMessaging.registerDeviceForRemoteMessages.mockRejectedValueOnce(
          new Error('Registration failed'),
        );
        mockMessaging.getToken.mockRejectedValueOnce(new Error('Token failed'));

        const result = await service.initializeNotifications();

        expect(result.token).toBeUndefined();
        expect(result).toHaveProperty('unsubscribe');
      });

      it('should register onMessage and onForegroundEvent handlers', async () => {
        mockNotifee.requestPermission.mockResolvedValue({
          authorizationStatus: 1, //AUTHORIZED
        });
        await service.initializeNotifications();

        expect(mockMessaging.onMessage).toHaveBeenCalled();
        expect(mockNotifee.onForegroundEvent).toHaveBeenCalled();
      });
    });
  });

  describe('Crash Reporting', () => {
    describe('initializeCrashReporting', () => {
      it('should initialize crash reporting', () => {
        expect(() => service.initializeCrashReporting()).not.toThrow();
      });
    });

    describe('recordNonFatalError', () => {
      it('should record Error instances', () => {
        const error = new Error('Test error');
        expect(() => service.recordNonFatalError(error)).not.toThrow();
      });

      it('should handle string errors', () => {
        expect(() => service.recordNonFatalError('String error')).not.toThrow();
      });

      it('should handle null errors', () => {
        expect(() => service.recordNonFatalError(null)).not.toThrow();
      });

      it('should handle undefined errors', () => {
        expect(() => service.recordNonFatalError(undefined)).not.toThrow();
      });

      it('should handle object errors', () => {
        const objectError = { message: 'Object error', code: 500 };
        expect(() => service.recordNonFatalError(objectError)).not.toThrow();
      });
    });
  });

  describe('Service Implementation', () => {
    it('should implement CrashReportingService interface', () => {
      expect(service.initializeCrashReporting).toBeDefined();
      expect(service.recordNonFatalError).toBeDefined();
    });

    it('should implement RemoteConfigService interface', () => {
      expect(service.initializeRemoteConfig).toBeDefined();
      expect(service.getStringValue).toBeDefined();
      expect(service.getBooleanValue).toBeDefined();
      expect(service.getNumberValue).toBeDefined();
    });

    it('should have notifications initialization method', () => {
      expect(service.initializeNotifications).toBeDefined();
    });
  });
});
