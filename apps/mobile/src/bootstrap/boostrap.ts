import { RNCrashlyticsService } from '~/services/crashlytics';
import { RNKeyValueStorageService } from '~/services/key-value-storage';
import { RNNotificationService } from '~/services/notifications';
import { RNRemoteConfigService } from '~/services/remote-config';
import { RNSecureStorageService } from '~/services/secure-storage';
import {
  CrashlyticsService,
  CrashlyticsServiceContainerKey,
  NotificationService,
  NotificationServiceContainerKey,
  RemoteConfigContainerKey,
  RemoteConfigService,
  KeyValueStorageServiceContainerKey,
  SecureStorageServiceContainerKey,
  useAppStore
} from '@perawallet/core';
import { container } from 'tsyringe';

container.register(CrashlyticsServiceContainerKey, {
  useClass: RNCrashlyticsService,
});
container.register(NotificationServiceContainerKey, {
  useClass: RNNotificationService,
});
container.register(RemoteConfigContainerKey, {
  useClass: RNRemoteConfigService,
});
container.register(SecureStorageServiceContainerKey, {
  useClass: RNSecureStorageService,
});
container.register(KeyValueStorageServiceContainerKey, {
  useClass: RNKeyValueStorageService,
});

export const bootstrapApp = async () => {
  const crashlyticsInit = container
    .resolve<CrashlyticsService>(CrashlyticsServiceContainerKey)
    .initialize();
  const remoteConfigInit = container
    .resolve<RemoteConfigService>(RemoteConfigContainerKey)
    .initialize();

  await Promise.allSettled([
    crashlyticsInit,
    remoteConfigInit,
  ]);

  const notificationResults = await container
    .resolve<NotificationService>(NotificationServiceContainerKey)
    .initialize();

    //TODO we might run into a chicken/egg situation here.  Need to make sure
    //the store is setup first
    useAppStore
      .getState()
      .setFcmToken(notificationResults.token || null);
};
