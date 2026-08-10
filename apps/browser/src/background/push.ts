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
    getMessaging,
    onBackgroundMessage,
    type MessagePayload,
} from 'firebase/messaging/sw'
import { getFirebaseApp } from '@perawallet/wallet-extension-platform-chrome'

declare const self: ServiceWorkerGlobalScope

/**
 * The backend sends data-only messages so titles stay client-formatted and the
 * deeplink keeps mobile's `data.url` shape. The SDK only auto-displays payloads
 * carrying a `notification` block, so rendering is ours — and it must happen on
 * every path: the SDK subscribes with `userVisibleOnly: true`, so a push that
 * displays nothing earns Chrome's generic "updated in the background" toast.
 */
export const handleBackgroundMessage = async (
    payload: MessagePayload,
): Promise<void> => {
    await self.registration.showNotification(
        payload.data?.title ?? 'Pera Wallet',
        {
            body: payload.data?.body,
            icon: '/icons/icon-128.png',
            data: { peraUrl: payload.data?.url },
        },
    )
}

export const handleNotificationClick = (event: NotificationEvent): void => {
    const url = (event.notification.data as { peraUrl?: string } | undefined)
        ?.peraUrl
    // Absent on FCM-tagged notifications and on anything we did not create.
    if (!url) return

    event.notification.close()
    event.waitUntil(
        chrome.tabs.create({
            url: chrome.runtime.getURL(
                `expanded.html?deeplink=${encodeURIComponent(url)}`,
            ),
        }),
    )
}

export const installPushHandlers = (): void => {
    const app = getFirebaseApp()
    // Constructing the SW messaging instance is what registers the SDK's
    // push/pushsubscriptionchange listeners, so this must run synchronously at
    // module scope — a worker woken *by* a push otherwise misses it.
    //
    // The handler's promise is deliberately returned rather than voided: the
    // SDK awaits it inside the push event's waitUntil, so voiding it would let
    // the event settle before showNotification resolves — and a push that
    // displays nothing earns Chrome's generic "updated in the background" toast.
    // oxlint-disable-next-line @typescript-eslint/no-misused-promises -- see above
    if (app) onBackgroundMessage(getMessaging(app), handleBackgroundMessage)
    self.addEventListener('notificationclick', handleNotificationClick)
}
