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

/**
 * Thrown when card creation requires a valid app-integrity (device
 * attestation) token and none is available, so the request cannot proceed.
 * Callers own the user-facing wording for their flow.
 */
export class CardIntegrityAttestationRequiredError extends Error {
    constructor(
        message = 'Device verification is required to create a Pera Card.',
    ) {
        super(message)
        this.name = 'CardIntegrityAttestationRequiredError'
    }
}

/**
 * Thrown when the funding address is already linked to a DIFFERENT Baanx user
 * (backend 400 on the mapping call). Terminal for this address — no retry can
 * succeed; the user must connect a different funding account. Callers own the
 * user-facing wording for their flow.
 */
export class CardAccountLinkedElsewhereError extends Error {
    constructor(
        message = 'This account is already linked to another Pera Card user.',
    ) {
        super(message)
        this.name = 'CardAccountLinkedElsewhereError'
    }
}

/**
 * Thrown when the Baanx user id needed to link the funding account can't be
 * resolved (`GET /v1/user` returned no user). Without it the account can't be
 * linked, and the backend would reject card creation anyway — so the flow
 * stops here rather than failing later with a less actionable error.
 */
export class CardUserUnavailableError extends Error {
    constructor(
        message = 'Your Pera Card account could not be loaded. Please sign in again.',
    ) {
        super(message)
        this.name = 'CardUserUnavailableError'
    }
}
