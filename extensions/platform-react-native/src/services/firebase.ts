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

import {
    type FirebaseCrashlyticsTypes,
    getCrashlytics,
    recordError,
    setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics'
import {
    fetchAndActivate,
    type FirebaseRemoteConfigTypes,
    getRemoteConfig,
    setConfigSettings,
    setDefaults,
    getValue,
} from '@react-native-firebase/remote-config'
import {
    type FirebaseMessagingTypes,
    getInitialNotification,
    getMessaging,
    getToken,
    onMessage,
    onNotificationOpenedApp,
} from '@react-native-firebase/messaging'
import {
    type Analytics,
    getAnalytics,
    logEvent as logEventGA,
} from '@react-native-firebase/analytics'
import { Platform } from 'react-native'
import notifee, {
    AndroidImportance,
    AuthorizationStatus,
    EventType,
    type NotificationAndroid,
} from '@notifee/react-native'
import {
    type CrashReportingService,
    type NotificationOpenListener,
    type PushNotificationInitResult,
    type PushNotificationService,
    type RemoteConfigService,
    type AnalyticsService,
    RemoteConfigDefaults,
    type RemoteConfigKey,
} from '@perawallet/wallet-extension-platform'
import { config } from '@perawallet/wallet-core-config'

const NOTIFICATION_SMALL_ICON = 'ic_notification_small'

export const androidForegroundNotification = (
    channelId: string,
): NotificationAndroid => ({
    channelId,
    smallIcon: NOTIFICATION_SMALL_ICON,
})

/**
 * Pulls the deeplink URL out of a push payload. Both notifee and FCM expose
 * the dApp-supplied custom fields under `data`; we mirror the in-app
 * notification schema, which carries the deeplink in `url`.
 */
const extractDeeplinkUrl = (
    data: Record<string, unknown> | undefined,
): string | undefined => {
    const url = data?.url
    return typeof url === 'string' && url.length > 0 ? url : undefined
}

export class RNFirebaseService
    implements
        CrashReportingService,
        RemoteConfigService,
        AnalyticsService,
        PushNotificationService
{
    remoteConfig: FirebaseRemoteConfigTypes.Module | null = null
    messaging: FirebaseMessagingTypes.Module | null = null
    analytics: Analytics | null = null
    crashlytics: FirebaseCrashlyticsTypes.Module | null = null

    // Single listener (the app registers one at the root). A cold-start tap
    // resolves during init, before the app mounts its listener, so the URL is
    // buffered and replayed on the first registration.
    private notificationOpenListener: NotificationOpenListener | null = null
    private pendingNotificationUrl: string | null = null

    private emitNotificationOpen(
        data: Record<string, unknown> | undefined,
    ): void {
        const url = extractDeeplinkUrl(data)
        if (!url) {
            return
        }
        if (this.notificationOpenListener) {
            this.notificationOpenListener(url)
        } else {
            this.pendingNotificationUrl = url
        }
    }

    addNotificationOpenListener(
        listener: NotificationOpenListener,
    ): () => void {
        this.notificationOpenListener = listener
        if (this.pendingNotificationUrl) {
            listener(this.pendingNotificationUrl)
            this.pendingNotificationUrl = null
        }
        return () => {
            if (this.notificationOpenListener === listener) {
                this.notificationOpenListener = null
            }
        }
    }

    async initializeRemoteConfig() {
        this.remoteConfig = await getRemoteConfig()
        await setConfigSettings(this.remoteConfig, {
            minimumFetchIntervalMillis: config.remoteConfigRefreshTime,
        })

        await setDefaults(this.remoteConfig, RemoteConfigDefaults)

        try {
            await fetchAndActivate(this.remoteConfig)
        } catch {
            // ignore fetch errors, rely on cached/default values
        }
    }

    getStringValue(key: RemoteConfigKey, fallback?: string): string {
        try {
            if (!this.remoteConfig) {
                return fallback ?? ''
            }
            return getValue(this.remoteConfig, key).asString()
        } catch {
            return fallback ?? ''
        }
    }
    getBooleanValue(key: RemoteConfigKey, fallback?: boolean): boolean {
        try {
            if (!this.remoteConfig) {
                return fallback ?? false
            }
            return getValue(this.remoteConfig, key).asBoolean()
        } catch {
            return fallback ?? false
        }
    }
    getNumberValue(key: RemoteConfigKey, fallback?: number): number {
        try {
            if (!this.remoteConfig) {
                return fallback ?? 0
            }
            return getValue(this.remoteConfig, key).asNumber()
        } catch {
            return fallback ?? 0
        }
    }

    async initializeNotifications(): Promise<PushNotificationInitResult> {
        // Allow user to opt into notifications
        const settings = await notifee.requestPermission()

        if (settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED) {
            return {
                token: undefined,
                unsubscribe: () => {},
            }
        }

        // Android notification channel
        if (Platform.OS === 'android') {
            await notifee.createChannel({
                id: 'default',
                name: 'Default',
                importance: AndroidImportance.DEFAULT,
                vibration: true,
            })
        }

        // FCM registration + token
        let token: string | undefined
        try {
            this.messaging = await getMessaging()
            token = await getToken(this.messaging)
        } catch {
            // noop
        }

        // Foreground message handler (show a local notification)
        const unsubscribeOnMessage = this.messaging
            ? onMessage(this.messaging, async remoteMessage => {
                  const title =
                      remoteMessage.notification?.title ?? 'Notification'
                  const body = remoteMessage.notification?.body ?? undefined

                  await notifee.displayNotification({
                      title,
                      body,
                      data: remoteMessage.data,
                      android: Platform.select({
                          android: androidForegroundNotification('default'),
                          ios: undefined,
                      }) as NotificationAndroid,
                  })
              })
            : () => {}

        // Foreground notification events — a tap on a notifee-displayed
        // notification routes its deeplink to the registered listener.
        const unsubscribeNotifeeForeground = notifee.onForegroundEvent(
            async ({ type, detail }) => {
                switch (type) {
                    case EventType.ACTION_PRESS:
                    case EventType.PRESS: {
                        this.emitNotificationOpen(detail.notification?.data)
                        break
                    }
                    default: {
                        break
                    }
                }
            },
        )

        // Tap that resumed the app from the background (FCM notification
        // message handled natively while backgrounded).
        const unsubscribeOnOpened = this.messaging
            ? onNotificationOpenedApp(this.messaging, remoteMessage => {
                  this.emitNotificationOpen(remoteMessage?.data)
              })
            : () => {}

        // Tap that cold-started the app. Buffered until the app registers its
        // listener (see addNotificationOpenListener).
        if (this.messaging) {
            void getInitialNotification(this.messaging).then(remoteMessage => {
                if (remoteMessage) {
                    this.emitNotificationOpen(remoteMessage.data)
                }
            })
        }

        return {
            token,
            unsubscribe: () => {
                unsubscribeOnMessage?.()
                unsubscribeNotifeeForeground()
                unsubscribeOnOpened()
            },
        }
    }

    initializeCrashReporting(): void {
        this.crashlytics = getCrashlytics()
        setCrashlyticsCollectionEnabled(this.crashlytics, true)
    }

    recordNonFatalError(error: unknown): void {
        if (!this.crashlytics) {
            return
        }

        if (error instanceof Error) {
            recordError(this.crashlytics, error)
        } else {
            recordError(this.crashlytics, new Error(String(error)))
        }
    }

    initializeAnalytics(): void {
        this.analytics = getAnalytics()
    }

    logEvent(key: string, payload?: Record<string, unknown>): void {
        if (this.analytics) {
            logEventGA<string>(this.analytics, key, payload)
        }
    }
}
