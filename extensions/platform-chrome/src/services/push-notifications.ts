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

import { getMessaging, getToken } from 'firebase/messaging'
import {
    type NotificationOpenListener,
    type PushNotificationInitResult,
    type PushNotificationService,
    type PushTokenRefreshListener,
} from '@perawallet/wallet-extension-platform'
import { config } from '@perawallet/wallet-core-config'
import { getFirebaseApp } from './firebase-app'
import { detectBrowser } from './browser'

const noop = (): void => undefined

/**
 * Token acquisition runs in a DOM realm (popup/expanded); the `push` handlers
 * live in the service worker. `firebase/messaging/sw` exports no token getter
 * and `firebase/messaging` throws outside a window — hence the split, bridged
 * by handing the background worker's registration to `getToken`.
 */
export class ChromePushNotificationService implements PushNotificationService {
    isSupported(): boolean {
        // Firefox extensions have background scripts, not a service worker, so
        // there is no registration to subscribe against.
        return (
            typeof navigator !== 'undefined' &&
            'serviceWorker' in navigator &&
            detectBrowser().name !== 'Firefox'
        )
    }

    async initializeNotifications(): Promise<PushNotificationInitResult> {
        // No unsubscribe: the receive path is owned by the service worker's
        // top-level registration, not by this realm.
        return { token: await this.getPushToken(), unsubscribe: noop }
    }

    async getPushToken(): Promise<string | undefined> {
        const app = getFirebaseApp()
        if (!app || !config.firebaseVapidKey) return undefined

        try {
            const serviceWorkerRegistration =
                await navigator.serviceWorker.getRegistration()
            if (!serviceWorkerRegistration) return undefined

            return await getToken(getMessaging(app), {
                vapidKey: config.firebaseVapidKey,
                serviceWorkerRegistration,
            })
        } catch {
            // Offline, revoked notification permission, or an FCM registration
            // failure. Callers read undefined as "no push"; this runs inside
            // cold-start bootstrap and must never reject it.
            return undefined
        }
    }

    addTokenRefreshListener(_listener: PushTokenRefreshListener): () => void {
        // The JS SDK dropped onTokenRefresh; the service worker re-mints on
        // pushsubscriptionchange and the visibility poll picks it up.
        return noop
    }

    addNotificationOpenListener(
        listener: NotificationOpenListener,
    ): () => void {
        // The service worker opens expanded.html?deeplink=… on click, so there
        // is no live channel to subscribe to — the URL is read once, at
        // registration, from the surface that the click created. Only `url`
        // survives that round trip, so type-routed taps (multisig) fall back
        // to URL routing here.
        const url = new URLSearchParams(location.search).get('deeplink')
        if (url) listener({ url })
        return noop
    }
}
