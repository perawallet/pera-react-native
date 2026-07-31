/*
 Copyright 2022-2026 Pera Wallet, LDA
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
    getRemoteConfig,
    getValue,
    type RemoteConfig,
} from '@react-native-firebase/remote-config'
import {
    type FirebaseMessagingTypes,
    getInitialNotification,
    getMessaging,
    getToken,
    onMessage,
    onNotificationOpenedApp,
    onTokenRefresh,
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
    type PushTokenRefreshListener,
    type RemoteConfigService,
    type AnalyticsService,
    RemoteConfigDefaults,
    type RemoteConfigKey,
} from '@perawallet/wallet-extension-platform'
import { config, isDebug } from '@perawallet/wallet-core-config'
import { withTimeout } from '@perawallet/wallet-core-shared'

const NOTIFICATION_SMALL_ICON = 'ic_notification_small'

// FCM/APNs registration is a known indefinite-hang surface offline. Bound the
// token fetch so cold-start degrades to a no-token result instead of stalling.
const FCM_TOKEN_FETCH_TIMEOUT_MS = 5000

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
    remoteConfig: RemoteConfig | null = null
    messaging: FirebaseMessagingTypes.Module | null = null
    analytics: Analytics | null = null
    crashlytics: FirebaseCrashlyticsTypes.Module | null = null

    // Single listener (the app registers one at the root). A cold-start tap
    // resolves during init, before the app mounts its listener, so the URL is
    // buffered and replayed on the first registration.
    private notificationOpenListener: NotificationOpenListener | null = null
    private pendingNotificationUrl: string | null = null

    isSupported(): boolean {
        return true
    }

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
        this.remoteConfig = getRemoteConfig()
        // v25 removed the modular setConfigSettings/setDefaults functions;
        // assign the Firebase-JS-v9 settings/defaultConfig properties instead
        // (assignment eagerly seeds the in-memory value cache).
        this.remoteConfig.settings = {
            ...this.remoteConfig.settings,
            minimumFetchIntervalMillis: config.remoteConfigRefreshTime,
        }
        this.remoteConfig.defaultConfig = RemoteConfigDefaults

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
            const value = getValue(this.remoteConfig, key)
            // `initializeRemoteConfig` seeds every boolean flag via
            // `setDefaults`, so `getValue` resolves without throwing even when
            // nothing has been fetched — it just returns the baked-in default
            // (source 'default'), or 'static' when the key is unknown. Treating
            // that as a real value would silently override the caller's
            // fallback (e.g. hiding Pera Card in dev/staging, where the fallback
            // is meant to enable it). Only trust a genuinely fetched value;
            // otherwise honour the caller's fallback.
            if (value.getSource() === 'remote') {
                return value.asBoolean()
            }
            return fallback ?? false
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

    /**
     * FCM registration + token. Time-boxed because getMessaging/getToken can
     * hang indefinitely offline; failures degrade to `undefined` rather than
     * rejecting.
     */
    private async fetchToken(): Promise<string | undefined> {
        try {
            return await withTimeout(
                (async () => {
                    this.messaging ??= await getMessaging()
                    return getToken(this.messaging)
                })(),
                FCM_TOKEN_FETCH_TIMEOUT_MS,
                'FCM token fetch',
            )
        } catch {
            // noop — degrade to no token (offline or timed-out registration)
            return undefined
        }
    }

    async getPushToken(): Promise<string | undefined> {
        try {
            const settings = await notifee.getNotificationSettings()
            if (
                settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED
            ) {
                return undefined
            }
        } catch {
            return undefined
        }

        return this.fetchToken()
    }

    addTokenRefreshListener(listener: PushTokenRefreshListener): () => void {
        let detach: (() => void) | undefined
        let cancelled = false

        // `getMessaging` is async and may not have run yet (a cold start that
        // timed out or was denied permission leaves `messaging` null), so
        // attach lazily instead of silently dropping the subscription.
        void (async () => {
            try {
                this.messaging ??= await getMessaging()
                if (cancelled) return
                detach = onTokenRefresh(this.messaging, listener)
            } catch {
                // No messaging instance — rotation events are unavailable. The
                // resume-time `getPushToken` re-read still covers the gap.
            }
        })()

        return () => {
            cancelled = true
            detach?.()
        }
    }

    async initializeNotifications(): Promise<PushNotificationInitResult> {
        // Allow user to opt into notifications. A rejection here (native
        // permission surface failing offline) degrades to "not authorized"
        // rather than rejecting the whole cold-start bootstrap.
        let settings: Awaited<ReturnType<typeof notifee.requestPermission>>
        try {
            settings = await notifee.requestPermission()
        } catch {
            return {
                token: undefined,
                unsubscribe: () => {},
            }
        }

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

        const token = await this.fetchToken()

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
        // Collect only from signed releases (staging QA + store prod). Debug
        // builds — local Metro/Expo bundles of either variant — otherwise
        // report local-only failures (unresolved dev modules, hot-reload
        // errors) into the SAME Firebase app as their variant's signed
        // release, drowning real crashes in noise. `isDebug` is the
        // debug-vs-release axis; the app variant is the wrong signal here.
        setCrashlyticsCollectionEnabled(this.crashlytics, !isDebug)
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
