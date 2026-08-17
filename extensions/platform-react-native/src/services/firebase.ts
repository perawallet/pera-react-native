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
    type Crashlytics,
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
    type Messaging,
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
    type NotificationOpenPayload,
    type PushNotificationInitResult,
    type PushNotificationService,
    type PushTokenRefreshListener,
    type RemoteConfigService,
    type AnalyticsService,
    RemoteConfigDefaults,
    type RemoteConfigKey,
} from '@perawallet/wallet-extension-platform'
import { config, isDebug } from '@perawallet/wallet-core-config'
import { logger, withTimeout } from '@perawallet/wallet-core-shared'

const NOTIFICATION_SMALL_ICON = 'ic_notification_small'

/**
 * `getRemoteConfig()` is typed as the Firebase-JS `RemoteConfig`, which exposes
 * `settings`/`defaultConfig` only as properties. The instance is really
 * `FirebaseConfigModule`, which also carries the awaitable equivalents — the
 * only way to know the native writes landed before fetching.
 */
type AwaitableRemoteConfig = RemoteConfig & {
    setConfigSettings(settings: {
        minimumFetchIntervalMillis: number
    }): Promise<void>
    setDefaults(defaults: typeof RemoteConfigDefaults): Promise<null>
}

// FCM/APNs registration is a known indefinite-hang surface offline. Bound the
// token fetch so cold-start degrades to a no-token result instead of stalling.
const FCM_TOKEN_FETCH_TIMEOUT_MS = 5000

export const androidForegroundNotification = (
    channelId: string,
): NotificationAndroid => ({
    channelId,
    smallIcon: NOTIFICATION_SMALL_ICON,
})

const asNonEmptyString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined

/**
 * Pulls the actionable fields out of a push payload. Both notifee and FCM
 * expose the dApp-supplied custom fields under `data`; we mirror the in-app
 * notification schema (`url`, `type`, `account_address`). `type`/`accountAddress`
 * are forwarded because some notifications (e.g. multisig sign requests) carry
 * no sign-request `url` and can only be routed by type.
 */
const extractNotificationPayload = (
    data: Record<string, unknown> | undefined,
): NotificationOpenPayload => ({
    url: asNonEmptyString(data?.url),
    type: asNonEmptyString(data?.type),
    accountAddress: asNonEmptyString(data?.account_address),
})

export class RNFirebaseService
    implements
        CrashReportingService,
        RemoteConfigService,
        AnalyticsService,
        PushNotificationService
{
    remoteConfig: RemoteConfig | null = null
    private remoteConfigInitInFlight: Promise<void> | null = null
    messaging: Messaging | null = null
    analytics: Analytics | null = null
    crashlytics: Crashlytics | null = null

    // Single listener (the app registers one at the root). A cold-start tap
    // resolves during init, before the app mounts its listener, so the payload
    // is buffered and replayed on the first registration.
    private notificationOpenListener: NotificationOpenListener | null = null
    private pendingNotificationPayload: NotificationOpenPayload | null = null
    // Same single-slot pattern, no replay: a foreground receive is only a
    // cache-freshness hint (see PushNotificationService).
    private notificationReceivedListener: (() => void) | null = null

    isSupported(): boolean {
        return true
    }

    private emitNotificationOpen(
        data: Record<string, unknown> | undefined,
    ): void {
        const payload = extractNotificationPayload(data)
        // Nothing actionable — neither a deeplink URL nor a type to route by.
        if (!payload.url && !payload.type) {
            return
        }
        if (this.notificationOpenListener) {
            this.notificationOpenListener(payload)
        } else {
            this.pendingNotificationPayload = payload
        }
    }

    addNotificationOpenListener(
        listener: NotificationOpenListener,
    ): () => void {
        this.notificationOpenListener = listener
        if (this.pendingNotificationPayload) {
            listener(this.pendingNotificationPayload)
            this.pendingNotificationPayload = null
        }
        return () => {
            if (this.notificationOpenListener === listener) {
                this.notificationOpenListener = null
            }
        }
    }

    addNotificationReceivedListener(listener: () => void): () => void {
        this.notificationReceivedListener = listener
        return () => {
            if (this.notificationReceivedListener === listener) {
                this.notificationReceivedListener = null
            }
        }
    }

    /**
     * Single-flight: a second concurrent fetch makes Firebase cancel the one
     * already in flight (the same NSURLErrorCancelled that broke this before),
     * so overlapping callers share one initialization. Cleared on settle, so a
     * later call still refetches.
     */
    async initializeRemoteConfig(): Promise<void> {
        this.remoteConfigInitInFlight ??= this.fetchRemoteConfig().finally(
            () => {
                this.remoteConfigInitInFlight = null
            },
        )

        return this.remoteConfigInitInFlight
    }

    private async fetchRemoteConfig(): Promise<void> {
        const remoteConfig = getRemoteConfig() as AwaitableRemoteConfig
        this.remoteConfig = remoteConfig

        // Must be awaited, not assigned. The `settings`/`defaultConfig` setters
        // are fire-and-forget (`void this.setConfigSettings(...)`) and queue the
        // native call on a microtask, while `fetchAndActivate` reaches native
        // synchronously — so assigning then fetching dispatched the fetch FIRST,
        // and native `setDefaults` then reset the config database mid-flight and
        // cancelled it (NSURLErrorCancelled → RC error 8003) on every launch.
        // The fetch never once succeeded, so every key served its bundled
        // default — an empty `staking_projects_i18n` among them (PERA-4836).
        await remoteConfig.setConfigSettings({
            // Firebase persists this interval across launches, so an hour in dev
            // means freshly published values are invisible for an hour.
            minimumFetchIntervalMillis: isDebug
                ? 0
                : config.remoteConfigRefreshTime,
        })
        await remoteConfig.setDefaults(RemoteConfigDefaults)

        try {
            await fetchAndActivate(remoteConfig)
        } catch (error) {
            // Best-effort — cached/default values still serve. Logged because a
            // silent catch here is what hid the failure above: every remote
            // value quietly degraded to its default with no signal at all.
            logger.warn(
                'Remote Config fetch failed; serving cached or default values',
                { source: 'FirebaseService.initializeRemoteConfig', error },
            )
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

                  // Any push implies server-side unread state changed — let
                  // the app refresh its badge/inbox without waiting out the
                  // poll interval.
                  this.notificationReceivedListener?.()

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
        // Not async: notifee expects a void-returning handler and nothing in
        // here awaits, so returning a promise only detached the body from
        // notifee's own error handling.
        const unsubscribeNotifeeForeground = notifee.onForegroundEvent(
            ({ type, detail }) => {
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
        // Fire-and-forget: the setting is best-effort and a failure must not
        // block crash reporting from initializing.
        void setCrashlyticsCollectionEnabled(this.crashlytics, !isDebug)
    }

    /**
     * `groupingKey` maps onto RN Firebase's `jsErrorName`, which prepends a
     * synthetic top stack frame carrying that string. Crashlytics fingerprints
     * non-fatals on the exception class plus the top frames, and every JS
     * non-fatal arrives as the same class — so that injected frame is the only
     * lever that separates two distinct error sites into distinct issues. It
     * also titles the issue, which is why the key should read as a description.
     *
     * Omit it and the error's real stack does the grouping, which is preferable
     * when there is one.
     */
    recordNonFatalError(error: unknown, groupingKey?: string): void {
        if (!this.crashlytics) {
            return
        }

        const reportable =
            error instanceof Error ? error : new Error(String(error))
        recordError(this.crashlytics, reportable, groupingKey)
    }

    initializeAnalytics(): void {
        this.analytics = getAnalytics()
    }

    logEvent(key: string, payload?: Record<string, unknown>): void {
        if (this.analytics) {
            // Fire-and-forget: analytics delivery must never surface to or
            // block the caller.
            void logEventGA<string>(this.analytics, key, payload)
        }
    }
}
