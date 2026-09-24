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
    CONNECTIONS_CONTROL_SCOPE,
    isWcPagePairMessage,
} from '@perawallet/wallet-core-browser-runtime'
import { ensureOffscreenDocument } from './offscreen'

// Every pairing is a live socket to a page-chosen bridge host in the offscreen
// document, so a page gets a small budget rather than an open tap. In-memory is
// enough: a SW idle-reset only helps a page that already went quiet.
const PAIR_BUDGET_PER_ORIGIN = 3
const PAIR_BUDGET_WINDOW_MS = 60_000

// Trust boundary: the control channel is gated to extension senders, so this is
// the only way a page's pair intent crosses in. The origin is stamped from the
// browser-provided `sender.origin`, never from the message.
export const installConnectModalPairRoute = ({
    chromeLike = chrome,
    ensureOffscreenDocumentLike = ensureOffscreenDocument,
}: {
    chromeLike?: typeof chrome
    ensureOffscreenDocumentLike?: () => Promise<void>
}): void => {
    const recentPairs = new Map<string, number[]>()

    // Sweeping every origin on every call keeps the map bounded by origins
    // active within the window — a page can only ever insert its own origin.
    const takeFromBudget = (origin: string): boolean => {
        const now = Date.now()
        for (const [key, stamps] of recentPairs) {
            const live = stamps.filter(t => now - t < PAIR_BUDGET_WINDOW_MS)
            if (live.length === 0) recentPairs.delete(key)
            else recentPairs.set(key, live)
        }
        const live = recentPairs.get(origin) ?? []
        if (live.length >= PAIR_BUDGET_PER_ORIGIN) return false
        live.push(now)
        recentPairs.set(origin, live)
        return true
    }

    chromeLike.runtime.onMessage.addListener((message, sender) => {
        // Always a synchronous `false`: onMessage is shared with other
        // listeners, and a truthy return would make chrome await a response.
        if (!isWcPagePairMessage(message)) return false

        // The pair event's fixed name is page-dispatchable, so provenance is
        // enforced here: the isolated relay's own read of the window's user
        // activation, which page script cannot forge. Legitimate pairs come
        // from a click on the injected connect-modal row.
        if (!message.hasUserActivation) return false

        // `isWcPagePairMessage` narrows to { scope, uri, hasUserActivation };
        // nothing origin-shaped on the message survives.
        const origin = sender?.origin
        if (!origin || origin === 'null' || !/^https?:\/\//.test(origin)) {
            return false
        }

        if (!takeFromBudget(origin)) return false

        // A page click is exactly when the SW may be waking from idle: ensure
        // the offscreen document before forwarding or the first pair is lost.
        void ensureOffscreenDocumentLike()
            .then(() =>
                chromeLike.runtime.sendMessage({
                    scope: CONNECTIONS_CONTROL_SCOPE,
                    kind: 'pair',
                    uri: message.uri,
                    requesterOrigin: origin,
                }),
            )
            .catch((error: unknown) => {
                // Nobody awaits this listener, so log rather than leave an unhandled rejection.
                console.error(
                    '[pera] connect-modal pair ensure-offscreen/forward failed:',
                    error,
                )
            })
        return false
    })
}
