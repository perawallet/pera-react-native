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
} from '@perawallet/wallet-core-shared'
import { getCardApiError } from '../errors'
import { getCardTransport } from '../transport'
import { CardAccountLinkedElsewhereError } from './errors'
import { createCardResponseSchema } from './schema'

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
        })
        return createCardResponseSchema.parse(response.data)
    } catch (error) {
        // The route's only 400 is the linked-elsewhere conflict (malformed
        // bodies are 422s), and it is terminal for this address — typed so
        // the UI can say more than "try again".
        if ((await getCardApiError(error)).status === 400) {
            throw new CardAccountLinkedElsewhereError()
        }
        throw error
    }
}
