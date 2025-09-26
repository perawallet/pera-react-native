import { getCrashlytics } from '@react-native-firebase/crashlytics';
import { getRemoteConfig } from '@react-native-firebase/remote-config';
import { getMessaging } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import notifee, { AndroidImportance, AuthorizationStatus, EventType } from '@notifee/react-native';
import {
  CrashReportingService,
  NotificationsInitResult,
  RemoteConfigKey,
  RemoteConfigService,
} from '@perawallet/core';

export class RNFirebaseService
  implements CrashReportingService, RemoteConfigService, CrashReportingService
{
  async initializeRemoteConfig() {
    // Configure fetch interval (1 hour)
    await getRemoteConfig().setConfigSettings({
      minimumFetchIntervalMillis: 60 * 60 * 1000,
    });

    // TODO: setup defaults here but load them from somewhere central? Config?
    await getRemoteConfig().setDefaults({});

    try {
      await getRemoteConfig().fetchAndActivate();
    } catch {
      // ignore fetch errors, rely on cached/default values
    }
  }

  getStringValue(key: RemoteConfigKey, fallback?: string): string {
    try {
      return getRemoteConfig().getValue(key).asString();
    } catch {
      return fallback ?? '';
    }
  }
  getBooleanValue(key: RemoteConfigKey, fallback?: boolean): boolean {
    try {
      return getRemoteConfig().getValue(key).asBoolean();
    } catch {
      return fallback ?? false;
    }
  }
  getNumberValue(key: RemoteConfigKey, fallback?: number): number {
    try {
      return getRemoteConfig().getValue(key).asNumber();
    } catch {
      return fallback ?? 0;
    }
  }

  async initializeNotifications(): Promise<NotificationsInitResult> {
    // Allow user to opt into notifications
    const settings = await notifee.requestPermission();

    if (settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED) {
      return {
        token: undefined,
        unsubscribe: () => {}
      }
    }

    // Android notification channel
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'default',
        name: 'Default',
        importance: AndroidImportance.DEFAULT,
        vibration: true,
      });
    }

    // FCM registration + token
    let token: string | undefined;
    try {
      await getMessaging().registerDeviceForRemoteMessages();
      token = await getMessaging().getToken();
    } catch {
      // noop
      // TODO: do we want to do something here?
    }

    // Foreground message handler (show a local notification)
    const unsubscribeOnMessage = getMessaging().onMessage(async remoteMessage => {
      const title = remoteMessage.notification?.title ?? 'Notification';
      const body = remoteMessage.notification?.body ?? undefined;

      await notifee.displayNotification({
        title,
        body,
        data: remoteMessage.data,
        android: Platform.select({
          android: { channelId: 'default' },
          ios: undefined,
        }) as any,
      });
    });

    // Foreground notification events
    const unsubscribeNotifeeForeground = notifee.onForegroundEvent(
      async ({ type }) => {
        switch (type) {
          case EventType.ACTION_PRESS:
          case EventType.PRESS:
            // TODO: Handle taps or actions
            break;
          default:
            break;
        }
      },
    );

    return {
      token,
      unsubscribe: () => {
        unsubscribeOnMessage();
        unsubscribeNotifeeForeground();
      },
    };
  }

  initializeCrashReporting(): void {
    getCrashlytics()
      .setCrashlyticsCollectionEnabled(true)
      .catch(() => {});
  }

  recordNonFatalError(error: unknown): void {
    if (error instanceof Error) {
      getCrashlytics().recordError(error);
    } else {
      getCrashlytics().recordError(new Error(String(error)));
    }
  }
}
