import { RNDeviceInfoStorageService } from '../platform/device';
import { RNFirebaseService } from '../platform/firebase';
import { RNKeyValueStorageService } from '../platform/key-value-storage';
import { RNSecureStorageService } from '../platform/secure-storage';
import {
  useCrashReportingService,
  useRemoteConfigService,
  useNotificationService,
  registerPlatformServices,
  useAppStore,
  useDevice,
} from '@perawallet/core';

const firebaseService = new RNFirebaseService();
const platformServices = {
  crashReporting: firebaseService,
  notification: firebaseService,
  remoteConfig: firebaseService,
  secureStorage: new RNSecureStorageService(),
  keyValueStorage: new RNKeyValueStorageService(),
  deviceInfo: new RNDeviceInfoStorageService(),
};

registerPlatformServices(platformServices);

export const useBootstrapper = () => {
  const crashlyticsService = useCrashReportingService();
  const remoteConfigService = useRemoteConfigService();
  const notificationService = useNotificationService();
  const { registerDevice } = useDevice();

  const setFcmToken = useAppStore(state => {
    return state.setFcmToken;
  });

  return async () => {
    const crashlyticsInit = crashlyticsService.initializeCrashReporting();
    const remoteConfigInit = remoteConfigService.initializeRemoteConfig();

    await Promise.allSettled([crashlyticsInit, remoteConfigInit]);

    const notificationResults =
      await notificationService.initializeNotifications();

    setFcmToken(notificationResults.token || null);
    registerDevice();

    return platformServices;
  };
};
