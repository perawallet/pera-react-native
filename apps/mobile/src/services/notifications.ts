import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import {
  NotificationsInitResult,
  NotificationService,
} from '@perawallet/core';

export class RNNotificationService implements NotificationService {
  async initialize(): Promise<NotificationsInitResult> {
    // Permissions
    try {
      // iOS: request authorization; Android 13+: POST_NOTIFICATIONS runtime permission
      await notifee.requestPermission();
    } catch (e) {
      // noop
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
      await messaging().registerDeviceForRemoteMessages();
      token = await messaging().getToken();
    } catch {
      // noop
    }

    // Foreground message handler (show a local notification)
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
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
            // Handle taps or actions
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
}
