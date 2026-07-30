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
    WC_CONTROL_SCOPE,
    isWcPagePairMessage,
} from '@perawallet/wallet-extension-platform-chrome'
import { ensureOffscreenDocument } from './offscreen'

/**
 * Accepts a page-originated WalletConnect pair request from the connect-modal
 * content script and translates it into a `pair` control message for the
 * offscreen document.
 *
 * This is the trust boundary. The WC control channel is gated to
 * extension-origin senders, so a content script cannot reach it directly; this
 * route is the only way a page's intent crosses into the wallet, and it exists
 * so the origin can be stamped from the browser-provided `sender.origin`
 * rather than taken from the message. Copies the posture of
 * ChromeDappRouter.handleMessage (extensions/platform-chrome/src/dapp/router.ts).
 *
 * The pairing itself is still inert until the user approves it in the approval
 * surface — this route only starts a handshake whose accounts the user must
 * then select and grant.
 */
export const installConnectModalPairRoute = ({
    chromeLike = chrome,
    ensureOffscreenDocumentLike = ensureOffscreenDocument,
}: {
    chromeLike?: typeof chrome
    ensureOffscreenDocumentLike?: () => Promise<void>
}): void => {
    chromeLike.runtime.onMessage.addListener((message, sender) => {
        // Synchronous false-return: chrome.runtime.onMessage is shared with the
        // DB-control listener, the approval bridge and the dapp router, and
        // returning false is how this listener says "not mine". The ensure
        // below is fired-and-forgotten from the listener's point of view —
        // it must never make this callback return a truthy/promise value,
        // or chrome would wait on it as a response.
        if (!isWcPagePairMessage(message)) return false

        // Origin is browser-stamped on the sender — never a page-asserted
        // field. Anything origin-shaped ON the message is ignored by
        // construction: isWcPagePairMessage narrows to { scope, uri } only.
        // Rejecting the opaque 'null' origin is redundant with the regex
        // below (no http(s) string is ever literally "null"), but it stays
        // for parity with ChromeDappRouter.handleMessage and to document
        // intent explicitly rather than leaving it implicit in the regex.
        const origin = sender?.origin
        if (!origin || origin === 'null' || !/^https?:\/\//.test(origin)) {
            return false
        }

        // A page click on the injected row is exactly the case where the SW
        // may be waking from idle: ensure the offscreen document (and its
        // WC control listener) exists before forwarding, rather than
        // dropping the very first pair on a cold start. Mirrors the
        // heartbeat alarm's ensure-then-send precedent in ./index.ts.
        // No `correlationId`: nothing on this route ever awaits a
        // `pair-outcome` broadcast (unlike `useWalletConnectPairing.web.ts`,
        // which mints its own and filters `onPairOutcome` by it) — there is
        // no page-facing surface to report a page-initiated pair's outcome
        // to (see the design doc's Error handling section), and `wcHost.ts`'s
        // `WcControlMessage.pair.correlationId` doc comment confirms the
        // host tolerates its absence: "a caller with no interest in the
        // outcome ... can pair without one, and the host simply never tracks
        // or reports back on it." Minting one anyway would only cost an
        // offscreen `pair-outcome` broadcast nobody is listening for.
        void ensureOffscreenDocumentLike()
            .then(() =>
                chromeLike.runtime.sendMessage({
                    scope: WC_CONTROL_SCOPE,
                    kind: 'pair',
                    uri: message.uri,
                    requesterOrigin: origin,
                }),
            )
            .catch((error: unknown) => {
                // Nobody is awaiting this listener's return value (chrome
                // discards it once we return false below), so a rejected
                // ensure/sendMessage here would otherwise surface as an
                // unhandled rejection instead of just failing this one pair
                // attempt silently.
                console.error(
                    '[pera] connect-modal pair ensure-offscreen/forward failed:',
                    error,
                )
            })
        return false
    })
}
