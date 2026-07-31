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

export type PushNotificationInitResult = {
    token?: string
    unsubscribe: () => void
}

/**
 * Called with the deeplink URL carried by a tapped push notification
 * (foreground, background-resume, or cold-start).
 */
export type NotificationOpenListener = (deeplinkUrl: string) => void

/** Called with the freshly issued push token whenever it changes. */
export type PushTokenRefreshListener = (token: string) => void

export interface PushNotificationService {
    /** Static platform fact: can this platform deliver push at all? */
    isSupported(): boolean
    initializeNotifications(): Promise<PushNotificationInitResult>
    /**
     * Re-reads the push token, returning `undefined` while notification
     * permission is not granted (or registration is unavailable, e.g. offline).
     * `initializeNotifications` only resolves a token if permission was already
     * granted at cold start, so callers use this to pick one up after the user
     * grants permission mid-session.
     */
    getPushToken(): Promise<string | undefined>
    /**
     * Subscribes to token rotation. The platform can reissue a token at any
     * point in a session (reinstall-restore, app-data clear, FCM-side
     * rotation); without this the backend keeps pushing to the dead one until
     * the next cold start. Returns an unsubscribe function.
     */
    addTokenRefreshListener(listener: PushTokenRefreshListener): () => void
    /**
     * Registers a listener for push-notification taps that carry a deeplink
     * URL. Returns an unsubscribe function. A cold-start tap that resolves
     * before any listener is registered is replayed to the first listener so
     * launching the app from a notification isn't lost to a race.
     */
    addNotificationOpenListener(listener: NotificationOpenListener): () => void
}
