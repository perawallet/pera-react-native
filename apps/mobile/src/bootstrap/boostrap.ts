import { RNFirebaseService } from '../services/firebase';
import { RNKeyValueStorageService } from '../services/key-value-storage';
import { RNSecureStorageService } from '../services/secure-storage';
import {
  CrashReportingService,
  CrashReportingServiceContainerKey,
  NotificationService,
  NotificationServiceContainerKey,
  RemoteConfigServiceContainerKey,
  RemoteConfigService,
  KeyValueStorageServiceContainerKey,
  SecureStorageServiceContainerKey,
  SecureStorageService,
  KeyValueStorageService,
  createAppStore
} from '@perawallet/core';
import { container } from 'tsyringe';

console.log('REGISTERING PLATFORM IMPL')

const firebaseService = new RNFirebaseService()

container.register<CrashReportingService>(CrashReportingServiceContainerKey, {
  useValue: firebaseService,
});
container.register<NotificationService>(NotificationServiceContainerKey, {
  useValue: firebaseService,
});
container.register<RemoteConfigService>(RemoteConfigServiceContainerKey, {
  useValue: firebaseService,
});
container.register<SecureStorageService>(SecureStorageServiceContainerKey, {
  useValue: new RNSecureStorageService(),
});
container.register<KeyValueStorageService>(KeyValueStorageServiceContainerKey, {
  useValue: new RNKeyValueStorageService(),
});

export var useAppStore = createAppStore()

export const bootstrapApp = async () => {
  const crashlyticsInit = container
    .resolve<CrashReportingService>(CrashReportingServiceContainerKey)
    .initializeCrashReporting();
  const remoteConfigInit = container
    .resolve<RemoteConfigService>(RemoteConfigServiceContainerKey)
    .initializeRemoteConfig();

  await Promise.allSettled([
    crashlyticsInit,
    remoteConfigInit,
  ]);

  const notificationResults = await container
    .resolve<NotificationService>(NotificationServiceContainerKey)
    .initializeNotifications();

    useAppStore
      .getState()
      .setFcmToken(notificationResults.token || null);
};
