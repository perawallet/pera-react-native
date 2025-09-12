import { RNFirebaseService } from '../platform/firebase';
import { RNKeyValueStorageService } from '../platform/key-value-storage';
import { RNSecureStorageService } from '../platform/secure-storage';
import {
  createAppStore,
  useCrashReportingService,
  useRemoteConfigService,
  useNotificationService,
  registerPlatformServices,
} from '@perawallet/core';

const firebaseService = new RNFirebaseService();
const platformServices = {
  crashReporting: firebaseService,
  notification: firebaseService,
  remoteConfig: firebaseService,
  secureStorage: new RNSecureStorageService(),
  keyValueStorage: new RNKeyValueStorageService()
}

registerPlatformServices(platformServices)

export var useAppStore = createAppStore();

export const useBootstrapper = () => {
  const crashlyticsService = useCrashReportingService()
  const remoteConfigService = useRemoteConfigService()
  const notificationService = useNotificationService()
  
  return async () => {
    const crashlyticsInit = crashlyticsService.initializeCrashReporting();
    const remoteConfigInit = remoteConfigService.initializeRemoteConfig();

    await Promise.allSettled([crashlyticsInit, remoteConfigInit]);

    const notificationResults = await notificationService.initializeNotifications();

    useAppStore.getState().setFcmToken(notificationResults.token || null);

    return platformServices
  }
};
