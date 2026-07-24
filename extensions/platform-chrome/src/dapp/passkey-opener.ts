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
    type SerializedCreateOptions,
    type SerializedGetOptions,
    type SerializedCredential,
} from '@perawallet/wallet-core-passkeys/webauthn'

// Settled by resolve-passkey (a minted/asserted credential), reject-passkey
// (an explicit reason — user decline or an authenticator error name, see
// usePasskeyApproval) or a window close (null, same as every other kind).
// The reason string (not just null) is what lets the content script
// translate a decline into the *specific* native WebAuthn error the page's
// `navigator.credentials` promise should reject with, rather than a single
// generic cancellation.
export type PasskeyDecision =
    | { credential: SerializedCredential }
    | { error: string }
    | null

export type PasskeyCreateApprovalContext = {
    requestId: string
    // Browser-stamped frame origin (never page-asserted) — passed
    // verbatim as SigningContext.origin to the authenticator core by
    // usePasskeyApproval.
    origin: string
    rpId: string
    userName?: string
    options: SerializedCreateOptions
}

export type PasskeyGetApprovalContext = {
    requestId: string
    origin: string
    rpId: string
    userName?: string
    options: SerializedGetOptions
}

export interface PasskeyApprovalOpener {
    openPasskeyCreate(
        ctx: PasskeyCreateApprovalContext,
    ): Promise<PasskeyDecision>
    openPasskeyGet(ctx: PasskeyGetApprovalContext): Promise<PasskeyDecision>
}
