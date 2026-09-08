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

import type { Network } from '@perawallet/wallet-core-shared'
import { getCardApiError, isAlreadyCreatedError } from '../errors'
import { getCardTransport } from '../transport'
import type { CardSiwaSignData } from '../card-creation'
import {
    delegatorLsigResponseSchema,
    escrowCardApprovalResponseSchema,
} from './schema'

export type ApproveEscrowCardParams = {
    network: Network
    /** Escrow card address from the backend create-card response. AB keys the approval by the card, not the funding wallet. */
    cardAddress: string
    /** Settlement currency as AB expects it, e.g. "usdc". */
    currency: string
    /** ARC-60 SIWA sign data, the SAME proof sent to the backend create-card call. */
    signData: CardSiwaSignData
    /** Base64 ed25519 signature over `sha256(data) || sha256(authData)`. */
    signature: string
    /** Transaction id of the on-chain `cardCreate` call, from the backend create-card response. */
    txId: string
    signal?: AbortSignal
}

/**
 * Records the card-creation approval with AB. The on-chain `cardCreate` has
 * already happened via the Pera backend (`api/card-creation`) by the time
 * this is called; AB receives its transaction hash to register the card in
 * its own systems. `amount` is "0": this call funds nothing.
 *
 * The body is exactly AB's schema: it rejects unknown fields, so nothing
 * extra may be added. A re-run replays 200 (idempotent); the already-created
 * catch keeps an older rejection resolving the same way.
 */
export const approveEscrowCard = async (
    params: ApproveEscrowCardParams,
): Promise<{ cardAddress: string } | null> => {
    const {
        network,
        cardAddress,
        currency,
        signData,
        signature,
        txId,
        signal,
    } = params

    try {
        const response = await getCardTransport().request({
            network,
            route: 'escrow',
            method: 'POST',
            path: '/api/approvals',
            data: {
                blockchain: 'algorand',
                address: cardAddress,
                currency,
                amount: '0',
                transaction: { hash: txId },
                signData,
                signature,
            },
            signal,
        })
        const parsed = escrowCardApprovalResponseSchema.parse(response.data)
        return { cardAddress: parsed.address }
    } catch (error) {
        const apiError = await getCardApiError(error)
        if (isAlreadyCreatedError(apiError)) return null
        throw error
    }
}

export type PostDelegatorLsigParams = {
    network: Network
    /** Token SYMBOL AB keys the delegation by, e.g. "usdc". */
    token: string
    /** Delegator (funding-source) address that signed the LogicSig. */
    delegatorAddress: string
    /** Base64 msgpack-encoded signed delegated LogicSigAccount. */
    lsigBytes: string
    /** Escrow card address returned by the backend create-card call. */
    cardAddress: string
    signal?: AbortSignal
}

/**
 * Persists the signed AutoDraw LogicSig with AB, keyed by the delegator that
 * signed it. The delegation signature is itself the ownership proof, so no
 * separate SIWA signature accompanies it.
 */
export const postDelegatorLsig = async (
    params: PostDelegatorLsigParams,
): Promise<{ delegatorAddress: string }> => {
    const { network, token, delegatorAddress, lsigBytes, cardAddress, signal } =
        params

    const response = await getCardTransport().request({
        network,
        route: 'escrow',
        method: 'POST',
        path: '/api/internal/delegator-lsig',
        data: {
            token,
            delegatorAddress,
            lsigBytes,
            cardAddress,
            blockchain: 'algorand',
        },
        signal,
    })

    const parsed = delegatorLsigResponseSchema.parse(response.data)
    return { delegatorAddress: parsed.delegatorAddress ?? delegatorAddress }
}
