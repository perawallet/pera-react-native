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
    DAPP_PAGE_RESPONSE_SCOPE,
    isDappHostResponseMessage,
    isDappPageRequestMessage,
    isSecureDappOrigin,
    isTrustedExtensionPageSender,
    sendDappHostRequest,
    type DappPageRequestAck,
    type DappPageResponseMessage,
} from '@perawallet/wallet-extension-platform-chrome'
import {
    JsonRpcErrorCode,
    jsonRpcError,
} from '@perawallet/wallet-core-dapp/wire'
import { isWithinDappPayloadBounds } from '@perawallet/wallet-core-dapp/bounds'
import { ensureOffscreenDocument } from './offscreen'

// The relay in the receiving tab filters by origin before the page sees
// anything, which is what makes this safe: `tabs.sendMessage` fans out to every
// frame, and the tab may have navigated since the request.
//
// `onUndelivered` exists because a broadcast legitimately misses tabs without
// our relay, while an answer aimed at one tab that misses is worth the Chrome
// reason.
const deliverToTab = (
    chromeLike: typeof chrome,
    tabId: number,
    message: DappPageResponseMessage,
    onUndelivered?: (reason: unknown) => void,
): Promise<boolean> =>
    chromeLike.tabs.sendMessage(tabId, message).then(
        () => true,
        (reason: unknown) => {
            onUndelivered?.(reason)
            return false
        },
    )

// No `tabs` permission, so URLs are stripped from query results.
const broadcastToTabs = (
    chromeLike: typeof chrome,
    message: DappPageResponseMessage,
): Promise<boolean> =>
    chromeLike.tabs
        .query({})
        .then(tabs =>
            Promise.all(
                tabs.map(tab =>
                    tab.id === undefined
                        ? false
                        : deliverToTab(chromeLike, tab.id, message),
                ),
            ).then(() => true),
        )

/**
 * Trust boundary for window.pera. Origin is the browser-stamped `sender.origin`,
 * never a message field, and the request is bounded before it is forwarded or
 * parked anywhere. The ack is immediate; the answer arrives later on
 * DAPP_PAGE_RESPONSE_SCOPE, so an evicted worker never strands a held callback.
 */
export const installDappPageRequestRoute = ({
    chromeLike = chrome,
    ensureOffscreenDocumentLike = ensureOffscreenDocument,
}: {
    chromeLike?: typeof chrome
    ensureOffscreenDocumentLike?: () => Promise<void>
} = {}): void => {
    chromeLike.runtime.onMessage.addListener(
        (message, sender, sendResponse: (ack: DappPageRequestAck) => void) => {
            if (!isDappPageRequestMessage(message)) return false
            const { request, hasUserActivation } = message
            const refuse = (code: number, text: string): boolean => {
                sendResponse({
                    ok: false,
                    response: jsonRpcError(request.id, code, text),
                })
                return true
            }

            const origin = sender?.origin
            const tabId = sender?.tab?.id
            if (sender?.id !== chromeLike.runtime.id || tabId === undefined) {
                return refuse(JsonRpcErrorCode.Unauthorized, 'Untrusted sender')
            }
            if (!isSecureDappOrigin(origin)) {
                return refuse(JsonRpcErrorCode.Unauthorized, 'Insecure origin')
            }
            if (!isWithinDappPayloadBounds(request)) {
                return refuse(
                    JsonRpcErrorCode.InvalidParams,
                    'Request exceeds size limits',
                )
            }
            sendResponse({ ok: true })

            // Chrome only fills favIconUrl for hosts the manifest grants, so this
            // is inert for ordinary pages today. Granting the `tabs` permission
            // would silently make it a page-controlled URL fetched when the
            // approval opens — revisit this fallback before adding that permission.
            const faviconUrl = sender.tab?.favIconUrl
            void sendDappHostRequest(
                {
                    origin,
                    hasUserActivation,
                    ...(faviconUrl ? { faviconUrl } : {}),
                    returnTo: { tabId },
                    request,
                },
                { chromeLike, ensureHost: ensureOffscreenDocumentLike },
            ).catch((error: unknown) => {
                // The thrown error is synthetic (the host client discards the
                // Chrome reason), so log the request context that makes it useful.
                console.error(
                    '[pera] dapp request could not reach the host:',
                    { origin, method: request.method, id: request.id },
                    error,
                )
                void deliverToTab(
                    chromeLike,
                    tabId,
                    {
                        scope: DAPP_PAGE_RESPONSE_SCOPE,
                        origin,
                        payload: jsonRpcError(
                            request.id,
                            JsonRpcErrorCode.InternalError,
                            'Wallet unavailable',
                        ),
                    },
                    reason =>
                        console.warn(
                            '[pera] dapp failure notice could not reach tab',
                            tabId,
                            reason,
                        ),
                )
            })
            return true
        },
    )
}

/** Offscreen answers and notifications, delivered to the requesting tab or to every tab of the origin. */
export const installDappHostResponseRoute = ({
    chromeLike = chrome,
}: {
    chromeLike?: typeof chrome
} = {}): void => {
    chromeLike.runtime.onMessage.addListener(
        (message, sender, sendResponse) => {
            if (!isDappHostResponseMessage(message)) return false
            if (!isTrustedExtensionPageSender(sender, chromeLike)) return false
            const outbound: DappPageResponseMessage = {
                scope: DAPP_PAGE_RESPONSE_SCOPE,
                origin: message.origin,
                payload: message.payload,
            }
            const returnTo = message.returnTo
            const delivery = returnTo
                ? deliverToTab(chromeLike, returnTo.tabId, outbound, reason =>
                      console.warn(
                          '[pera] dapp response could not reach tab',
                          returnTo.tabId,
                          reason,
                      ),
                  )
                : broadcastToTabs(chromeLike, outbound)
            delivery.then(
                ok => sendResponse({ ok }),
                () => sendResponse({ ok: false }),
            )
            return true
        },
    )
}
