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

// Service-worker side of the WebAuthn-interception relay: authenticates the
// calling frame's origin off chrome.runtime.MessageSender (never the
// request's own `origin` field, which is page-adjacent content-script state,
// not browser-stamped at this boundary) and resolves the effective RP ID via
// Task 2's `resolveRpId` — the SAME function the authenticator core uses, so
// there is exactly one registrable-suffix implementation in this codebase,
// not two that could drift. A resolution failure (bad RP ID) collapses to a
// decline rather than a distinct error: the content script then falls
// through to the page's real `navigator.credentials`, which independently
// rejects with its own spec-correct SecurityError.
import { resolveRpId } from '@perawallet/wallet-core-passkeys/webauthn'
import { type ApprovalOpener } from './router'
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
        private readonly approvals: ApprovalOpener,
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
        // own (untrusted) `origin` field.
        const origin = sender?.origin
        if (!origin || origin === 'null' || !/^https?:\/\//.test(origin)) {
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
        // `null` (approval window closed with no answer) and a TRUE user
        // decline (usePasskeyApproval.decline() always sends the literal
        // reason 'declined') both collapse to `{ decline: true }` — the
        // content script falls through to native, which is the right
        // outcome for "the user said no" or "they closed the window."
        //
        // Any OTHER `{ error }` reason is usePasskeyApproval.approve()'s
        // catch handler forwarding a real `Error.name` from the Task 2
        // authenticator core (InvalidStateError, SecurityError,
        // NotAllowedError, ...) — see its comment. That must NOT collapse to
        // decline: falling through would let the native/OS authenticator
        // mint a credential the RP never asked for (e.g. a duplicate past
        // `excludeCredentials`), silently defeating the very check that
        // produced the error. Pass it through as a distinct wire shape so
        // webauthn-main.ts rejects the page's promise with the matching
        // native DOMException instead.
        if (decision && 'error' in decision && decision.error !== 'declined') {
            return { error: decision.error }
        }
        return DECLINE
    }
}
