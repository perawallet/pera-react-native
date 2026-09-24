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

import type { DappTransport, DappRespond } from '@perawallet/wallet-core-dapp'
import type { JsonRpcNotification } from '@perawallet/wallet-core-dapp/wire'
import { isTrustedExtensionPageSender } from '@perawallet/wallet-extension-platform-chrome/messaging'
import {
    DAPP_HOST_RESPONSE_SCOPE,
    isDappAck,
    isDappHostRequestMessage,
    type DappHostResponseMessage,
} from './dapp-wire'

const sendHostResponse = async (
    chromeLike: typeof chrome,
    message: Omit<DappHostResponseMessage, 'scope'>,
): Promise<void> => {
    let ack: unknown
    try {
        ack = await chromeLike.runtime.sendMessage({
            scope: DAPP_HOST_RESPONSE_SCOPE,
            ...message,
        })
    } catch {
        ack = undefined
    }
    // A missing ack means the tab is gone or the worker never took it; the
    // caller keeps the request answerable rather than treating it as delivered.
    if (!isDappAck(ack)) throw new Error('dapp response was not delivered')
}

/** Offscreen side of the transport: requests arrive from the service worker, answers go back through it. */
export const createChromeDappTransport = ({
    chromeLike = chrome,
}: { chromeLike?: typeof chrome } = {}): DappTransport => ({
    onRequest(listener) {
        const onMessage = (
            message: unknown,
            sender: chrome.runtime.MessageSender,
            sendResponse: (response: unknown) => void,
        ): boolean => {
            if (!isDappHostRequestMessage(message)) return false
            if (!isTrustedExtensionPageSender(sender, chromeLike)) return false
            const { origin, hasUserActivation, faviconUrl, returnTo, request } =
                message
            const respond: DappRespond = response =>
                sendHostResponse(chromeLike, {
                    origin,
                    payload: response,
                    returnTo,
                })
            // The ack means "received", not "handled". Acking after the listener
            // would let a synchronous throw trigger the worker's retry, and a
            // retried sign request is a second approval prompt for one call;
            // the page's own timeout already closes out a request nobody answers.
            sendResponse({ ok: true })
            try {
                listener(
                    {
                        origin,
                        hasUserActivation,
                        ...(faviconUrl ? { faviconUrl } : {}),
                    },
                    request,
                    respond,
                )
            } catch (error) {
                console.warn('[pera] dapp request listener threw', error)
            }
            return false
        }
        chromeLike.runtime.onMessage.addListener(onMessage)
        return () => chromeLike.runtime.onMessage.removeListener(onMessage)
    },
    async notify(origin: string, notification: JsonRpcNotification) {
        // Best-effort: a broadcast has no requester to keep answerable, and
        // every tab of the origin being gone is the normal steady state.
        try {
            await sendHostResponse(chromeLike, {
                origin,
                payload: notification,
            })
        } catch (error) {
            console.warn('[pera] dapp notification was not delivered', error)
        }
    },
})
