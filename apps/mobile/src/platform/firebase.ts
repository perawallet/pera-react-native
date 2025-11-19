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

import { getCrashlytics } from '@react-native-firebase/crashlytics'
import { getRemoteConfig } from '@react-native-firebase/remote-config'
import { getMessaging } from '@react-native-firebase/messaging'
import { getAnalytics } from '@react-native-firebase/analytics'
import { Platform } from 'react-native'
import notifee, {
    AndroidImportance,
    AuthorizationStatus,
    EventType,
} from '@notifee/react-native'
import {
    CrashReportingService,
    NotificationsInitResult,
    RemoteConfigDefaults,
    RemoteConfigKey,
    RemoteConfigService,
    AnalyticsService,
} from '@perawallet/core'
import { config } from '@perawallet/config'

export class RNFirebaseService
    implements
        CrashReportingService,
        RemoteConfigService,
        CrashReportingService,
        AnalyticsService
{
    async initializeRemoteConfig() {
        await getRemoteConfig().setConfigSettings({
            minimumFetchIntervalMillis: config.remoteConfigRefreshTime,
        })

        await getRemoteConfig().setDefaults(RemoteConfigDefaults)

        try {
            await getRemoteConfig().fetchAndActivate()
        } catch {
            // ignore fetch errors, rely on cached/default values
        }
    }

    getStringValue(key: RemoteConfigKey, fallback?: string): string {
        try {
            return getRemoteConfig().getValue(key).asString()
        } catch {
            return fallback ?? ''
        }
    }
    getBooleanValue(key: RemoteConfigKey, fallback?: boolean): boolean {
        try {
            return getRemoteConfig().getValue(key).asBoolean()
        } catch {
            return fallback ?? false
        }
    }
    getNumberValue(key: RemoteConfigKey, fallback?: number): number {
        try {
            return getRemoteConfig().getValue(key).asNumber()
        } catch {
            return fallback ?? 0
        }
    }

    async initializeNotifications(): Promise<NotificationsInitResult> {
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
            await getMessaging().registerDeviceForRemoteMessages()
            token = await getMessaging().getToken()
        } catch {
            // noop
        }

        // Foreground message handler (show a local notification)
        const unsubscribeOnMessage = getMessaging().onMessage(
            async remoteMessage => {
                const title =
                    remoteMessage.notification?.title ?? 'Notification'
                const body = remoteMessage.notification?.body ?? undefined

                await notifee.displayNotification({
                    title,
                    body,
                    data: remoteMessage.data,
                    android: Platform.select({
                        android: { channelId: 'default' },
                        ios: undefined,
                    }) as any,
                })
            },
        )

        // Foreground notification events
        const unsubscribeNotifeeForeground = notifee.onForegroundEvent(
            async ({ type }) => {
                switch (type) {
                    case EventType.ACTION_PRESS:
                    case EventType.PRESS:
                        // TODO: Handle taps or actions using deeplink parser when we have it
                        break
                    default:
                        break
                }
            },
        )

        return {
            token,
            unsubscribe: () => {
                unsubscribeOnMessage()
                unsubscribeNotifeeForeground()
            },
        }
    }

    initializeCrashReporting(): void {
        getCrashlytics()
            .setCrashlyticsCollectionEnabled(true)
            .catch(() => {})
    }

    recordNonFatalError(error: unknown): void {
        if (error instanceof Error) {
            getCrashlytics().recordError(error)
        } else {
            getCrashlytics().recordError(new Error(String(error)))
        }
    }

    initializeAnalytics(): void {}

    logEvent(key: string, payload?: any): void {
        getAnalytics().logEvent(key, payload)
    }
}
