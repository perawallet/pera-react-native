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
    addDeviceIntegrityHeader,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getCardApiError, type CardApiError } from '../errors'
import { getCardTransport } from '../transport'
import {
    CardAccountLinkedElsewhereError,
    CardCreateInProgressError,
    CardCreateUnavailableError,
    CardOwnershipProofRejectedError,
    CardSetupIncompleteError,
} from './errors'
import {
    createCardResponseSchema,
    fundingAddressLinkResponseSchema,
} from './schema'

// The backend mints the card on-chain and waits for confirmation; ky's 10 s
// default aborts that mid-flight and reports a failure for a call that is
// still succeeding server-side.
const CARD_CREATE_TIMEOUT_MS = 60_000

/** ARC-60 `StdSigData`, base64-encoded for the wire. */
export type CardSiwaSignData = {
    data: string
    authenticatorData: string
}

export type CreateCardParams = {
    network: Network
    /** Funding-source address proving ownership via the ARC-60 signature. */
    address: string
    /**
     * Baanx user id from `GET /v1/user` — the same id Baanx sends as `user_id`
     * on its webhooks. The backend links it to `address` (an idempotent
     * upsert, so every attempt self-heals a missing link) before creating.
     */
    baanxUserId: string
    /** Settlement currency, e.g. "usdc". */
    currency: string
    /** ARC-60 SIWA sign data (base64 canonical payload + domain hash). */
    signData: CardSiwaSignData
    /** Base64 ed25519 signature over `sha256(data) || sha256(authData)`. */
    signature: string
    /** Valid (non-expired) app-integrity attestation token. */
    integrityToken: string
    signal?: AbortSignal
}

export type CreateCardResult = {
    cardAddress: string
    txId: string
}

/**
 * Triggers on-chain Pera Card creation via the Pera backend: verifies the
 * ARC-60 ownership proof, links the funding address to the Baanx user,
 * submits the `cardCreate` app call, and returns the resulting card address
 * and transaction id.
 *
 * Throws {@link CardAccountLinkedElsewhereError} when the address is already
 * linked to a *different* Baanx user (backend 400) — terminal for this
 * address, since the backend would otherwise bind a card against that other
 * user's linkage.
 */
export const createCard = async (
    params: CreateCardParams,
): Promise<CreateCardResult> => {
    const {
        network,
        address,
        baanxUserId,
        currency,
        signData,
        signature,
        integrityToken,
        signal,
    } = params

    try {
        const response = await getCardTransport().request({
            network,
            route: 'proxy',
            method: 'POST',
            path: '/api/v3/baanx/escrow-card',
            data: {
                address,
                baanx_user_id: baanxUserId,
                currency,
                signData,
                signature,
            },
            headers: addDeviceIntegrityHeader({
                'x-app-integrity-token': integrityToken,
            }),
            signal,
            timeoutMs: CARD_CREATE_TIMEOUT_MS,
        })
        return createCardResponseSchema.parse(response.data)
    } catch (error) {
        throw mapCreateCardError(error, await getCardApiError(error))
    }
}

// The backend answers with a stable `code`; the 400 fallback stays because the
// route's only 400 is the linked-elsewhere conflict (malformed bodies are 422s).
const mapCreateCardError = (
    error: unknown,
    { code, status }: CardApiError,
): unknown => {
    if (code === 'ACCOUNT_LINKED_ELSEWHERE' || status === 400) {
        return new CardAccountLinkedElsewhereError()
    }
    if (code === 'CREATE_IN_PROGRESS') {
        return new CardCreateInProgressError()
    }
    if (code === 'BAANX_ACCOUNT_NOT_FOUND') {
        return new CardSetupIncompleteError()
    }
    if (status === 401) {
        return new CardOwnershipProofRejectedError(code)
    }
    if (status !== undefined && status >= 500) {
        return new CardCreateUnavailableError(code)
    }
    return error
}

export type FundingAddressLinkState =
    | 'unlinked'
    | 'linked_to_caller'
    | 'linked_to_other'

export type FundingAddressLink = {
    state: FundingAddressLinkState
    /** The caller's own card, when one exists. Never another user's. */
    cardAddress: Nullable<string>
}

export type FetchFundingAddressLinkParams = {
    network: Network
    address: string
    baanxUserId: string
    integrityToken: string
    signal?: AbortSignal
}

/**
 * Whether `address` can be connected as this Baanx user's funding source.
 *
 * Lets a caller refuse an account at selection time instead of discovering it
 * after the ownership signature, when {@link createCard} fails with
 * ACCOUNT_LINKED_ELSEWHERE. `linked_to_caller` is not a refusal: creation
 * resumes against the existing link, including when no card was minted yet.
 */
export const fetchFundingAddressLink = async (
    params: FetchFundingAddressLinkParams,
): Promise<FundingAddressLink> => {
    const { network, address, baanxUserId, integrityToken, signal } = params

    const response = await getCardTransport().request({
        network,
        route: 'proxy',
        method: 'GET',
        path: '/api/v3/baanx/card-address',
        params: { address, baanx_user_id: baanxUserId },
        headers: addDeviceIntegrityHeader({
            'x-app-integrity-token': integrityToken,
        }),
        signal,
    })
    const parsed = fundingAddressLinkResponseSchema.parse(response.data)
    return { state: parsed.linkState, cardAddress: parsed.cardAddress }
}
