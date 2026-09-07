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
} from '@perawallet/wallet-extension-platform-chrome'
import { ensureOffscreenDocument } from './offscreen'

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
    chromeLike.runtime.onMessage.addListener((message, sender) => {
        // Always a synchronous `false`: onMessage is shared with other
        // listeners, and a truthy return would make chrome await a response.
        if (!isWcPagePairMessage(message)) return false

        // `isWcPagePairMessage` narrows to { scope, uri }; nothing origin-shaped on the message survives.
        const origin = sender?.origin
        if (!origin || origin === 'null' || !/^https?:\/\//.test(origin)) {
            return false
        }

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
