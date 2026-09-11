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

/**
 * Backend 409: another request still holds this account's creation lock (the
 * backend serialises card creation per funding address). Retry after a moment.
 */
export class CardCreateInProgressError extends Error {
    constructor(
        message = 'Card creation is already in progress for this account.',
    ) {
        super(message)
        this.name = 'CardCreateInProgressError'
    }
}

/**
 * Backend 404 BAANX_ACCOUNT_NOT_FOUND: the Baanx account has no card record to
 * attach the escrow card to yet, so the remaining setup must finish first.
 */
export class CardSetupIncompleteError extends Error {
    constructor(message = 'Your Pera Card account setup is not complete yet.') {
        super(message)
        this.name = 'CardSetupIncompleteError'
    }
}

/**
 * Backend 401: the ARC-60 ownership proof was rejected. The common cause is a
 * funding account rekeyed on-chain that signed with its own, no longer
 * authorised key. Terminal for this account.
 */
export class CardOwnershipProofRejectedError extends Error {
    constructor(
        public readonly code?: string,
        message = 'This account could not prove ownership for card creation.',
    ) {
        super(message)
        this.name = 'CardOwnershipProofRejectedError'
    }
}

/**
 * Backend 5xx: creation could not be completed on-chain, or the service or its
 * node is unavailable. Nothing was minted for the caller, so retrying is safe.
 */
export class CardCreateUnavailableError extends Error {
    constructor(
        public readonly code?: string,
        message = 'Card creation is temporarily unavailable.',
    ) {
        super(message)
        this.name = 'CardCreateUnavailableError'
    }
}
