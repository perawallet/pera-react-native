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

// Service-worker side of the WebAuthn-interception relay. Authenticates off
// chrome.runtime.MessageSender, never the request's own `origin` field — that
// is content-script state, not browser-stamped at this boundary — and resolves
// the RP ID through the same `resolveRpId` the authenticator core uses, so the
// registrable-suffix check exists once and can't drift.
//
// A bad RP ID collapses to a decline: the content script falls through to the
// page's real `navigator.credentials`, which rejects with its own SecurityError.
import { resolveRpId } from '@perawallet/wallet-core-passkeys/webauthn'
import { type PasskeyApprovalOpener } from './passkey-opener'
import { isSecureDappOrigin } from './secure-origin'
import {
    isWebauthnRelayMessage,
    type WebauthnCeremonyRequest,
    type WebauthnCeremonyResponse,
} from './webauthn-router-protocol'

export {
    WEBAUTHN_RELAY_SCOPE,
    isWebauthnRelayMessage,
} from './webauthn-router-protocol'
export type {
    WebauthnCeremonyRequest,
    WebauthnCeremonyResponse,
} from './webauthn-router-protocol'

const DECLINE: WebauthnCeremonyResponse = { decline: true }

export class PasskeyRouter {
    constructor(
        private readonly approvals: PasskeyApprovalOpener,
        // Optional (not defaulted) — tests never call listen(), so the
        // ambient `chrome` global is only touched when it's actually invoked.
        private readonly chromeLike?: typeof chrome,
    ) {}

    listen(): void {
        ;(this.chromeLike ?? chrome).runtime.onMessage.addListener(
            this.handleMessage,
        )
    }

    // Arrow property so `this` is bound when used as an onMessage listener.
    handleMessage = (
        message: unknown,
        sender: chrome.runtime.MessageSender | undefined,
        sendResponse: (response: WebauthnCeremonyResponse) => void,
    ): boolean => {
        if (!isWebauthnRelayMessage(message)) return false

        // Browser-stamped, never page-asserted — see this file's header
        // comment and webauthn-router-protocol.ts's note on the request's
        // own (untrusted) `origin` field. Insecure origins decline here (and
        // the content script then falls through to the page's real
        // navigator.credentials, which refuses outside a secure context on
        // its own) — see secure-origin.ts for why the scheme is load-bearing.
        const origin = sender?.origin
        if (!isSecureDappOrigin(origin)) {
            sendResponse(DECLINE)
            return true
        }

        void this.route(message.request, origin).then(
            sendResponse,
            () => sendResponse(DECLINE), // never let a thrown error hang the page promise
        )
        return true // async sendResponse
    }

    private async route(
        request: WebauthnCeremonyRequest,
        origin: string,
    ): Promise<WebauthnCeremonyResponse> {
        let rpId: string
        try {
            rpId =
                request.kind === 'create'
                    ? resolveRpId(request.options.rp.id, origin)
                    : resolveRpId(request.options.rpId, origin)
        } catch {
            return DECLINE
        }

        const requestId = globalThis.crypto.randomUUID()
        const decision =
            request.kind === 'create'
                ? await this.approvals.openPasskeyCreate({
                      requestId,
                      origin,
                      rpId,
                      userName: request.options.user.name,
                      options: request.options,
                  })
                : await this.approvals.openPasskeyGet({
                      requestId,
                      origin,
                      rpId,
                      options: request.options,
                  })

        if (decision && 'credential' in decision) {
            return { credential: decision.credential }
        }
        // A closed window and a true decline both collapse to
        // `{ decline: true }`, falling through to native — the right outcome
        // for "the user said no".
        //
        // Any OTHER `{ error }` is a real `Error.name` from the authenticator
        // core and must NOT collapse: falling through would let the OS
        // authenticator mint a credential the RP never asked for (a duplicate
        // past `excludeCredentials`), defeating the check that produced the
        // error. Pass it through so webauthn-main.ts can reject with the
        // matching DOMException.
        if (decision && 'error' in decision && decision.error !== 'declined') {
            return { error: decision.error }
        }
        return DECLINE
    }
}
