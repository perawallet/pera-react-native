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

// Chrome transport binding for the platform-agnostic ARC-0027 core
// (@perawallet/wallet-core-arc0027's DappRequestRouter). This class owns
// everything chrome-specific: the onMessage listener, and — critically —
// authenticating the web origin off chrome.runtime.MessageSender (never a
// page-asserted field). Once the origin is validated, the request is handed
// to the core's handle(), which does the actual discover/enable/disable/
// sign_* dispatch with no chrome dependency at all.
import {
    ARC0027_ERROR_CODES,
    buildErrorResponse,
    DappRequestRouter,
    isDappRelayMessage,
    type Arc0027RequestEnvelope,
    type Arc0027ResponseEnvelope,
    type RouterDeps,
} from '@perawallet/wallet-core-arc0027'

export {
    DAPP_RELAY_SCOPE,
    isDappRelayMessage,
} from '@perawallet/wallet-core-arc0027'
export type { DiscoverInfo } from '@perawallet/wallet-core-arc0027'

const err = (
    request: Arc0027RequestEnvelope,
    code: number,
    message: string,
): Arc0027ResponseEnvelope => buildErrorResponse(request, { code, message })

// The untrusted-origin rejection fires BEFORE core.handle() has had a chance
// to shape-validate `request` (that validation lives entirely in the core
// now), so this can't assume `request` is a well-formed Arc0027RequestEnvelope
// — buildErrorResponse/parseReference would throw on a missing/invalid
// `reference`. Best-effort requestId extraction, fixed reference — the page
// correlates by requestId, not reference, so this is fine either way.
const untrustedOriginResponse = (request: unknown): Arc0027ResponseEnvelope => {
    const requestId =
        typeof request === 'object' &&
        request !== null &&
        typeof (request as { id?: unknown }).id === 'string'
            ? (request as { id: string }).id
            : 'unknown'
    return {
        id: globalThis.crypto.randomUUID(),
        requestId,
        reference: 'arc0027:discover:response',
        error: {
            code: ARC0027_ERROR_CODES.InvalidInputError,
            message: 'Untrusted origin',
        },
    }
}

export class ChromeDappRouter {
    private readonly core: DappRequestRouter

    constructor(
        deps: RouterDeps,
        // Optional (not defaulted) — tests never call listen(), so the
        // ambient `chrome` global is only touched when it's actually invoked.
        private readonly chromeLike?: typeof chrome,
    ) {
        this.core = new DappRequestRouter(deps)
    }

    listen(): void {
        ;(this.chromeLike ?? chrome).runtime.onMessage.addListener(
            this.handleMessage,
        )
    }

    // Arrow property so `this` is bound when used as an onMessage listener.
    handleMessage = (
        message: unknown,
        sender: chrome.runtime.MessageSender | undefined,
        sendResponse: (response: Arc0027ResponseEnvelope) => void,
    ): boolean => {
        // Synchronous false-return is load-bearing: chrome.runtime.onMessage
        // supports multiple listeners (e.g. PasskeyRouter's, on a different
        // message scope), and returning false here is how this listener
        // says "not mine, try the next one" — this check must stay sync.
        if (!isDappRelayMessage(message)) return false
        const { request } = message

        // Origin is browser-stamped on the sender — never a page-asserted
        // field. This is the trust boundary; it must be extracted here and
        // never delegated to anything that takes a caller-supplied origin
        // string without this extraction happening first.
        const origin = sender?.origin
        if (!origin || origin === 'null' || !/^https?:\/\//.test(origin)) {
            sendResponse(untrustedOriginResponse(request))
            return true
        }
        const faviconUrl = sender?.tab?.favIconUrl
        void this.core
            .handle(request, origin, faviconUrl)
            .then(sendResponse, e =>
                sendResponse(
                    err(
                        request,
                        ARC0027_ERROR_CODES.UnknownError,
                        e instanceof Error ? e.message : 'Router error',
                    ),
                ),
            )
        return true // async sendResponse
    }
}
