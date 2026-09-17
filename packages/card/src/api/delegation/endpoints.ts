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
import type { CardDelegationToken, CardExternalWallet } from '../../models'
import {
    delegationAcceptedResponseSchema,
    delegationTokenResponseSchema,
    externalWalletsResponseSchema,
} from './schema'
import { transformExternalWallet } from './transformers'

export type DelegationRequestParams = {
    network: Network
    signal?: AbortSignal
}

/** Single-use (~10 min) token pair consumed by the post-approval call. */
export const fetchDelegationToken = async (
    params: DelegationRequestParams,
): Promise<CardDelegationToken> => {
    const { network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'GET',
        path: '/v1/delegation/token',
        authenticated: true,
        signal,
    })

    return delegationTokenResponseSchema.parse(response.data)
}

export const fetchExternalWallets = async (
    params: DelegationRequestParams,
): Promise<CardExternalWallet[]> => {
    const { network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'GET',
        path: '/v1/wallet/external',
        authenticated: true,
        signal,
    })

    return externalWalletsResponseSchema
        .parse(response.data)
        .map(transformExternalWallet)
}

/**
 * A 2xx the schema cannot read is still a success: the delegation service
 * answers some calls with a bare status line, and rejecting that shape would
 * fail a registration it has already accepted. Only an explicit `success:
 * false` is a rejection.
 */
const assertAccepted = (data: unknown): void => {
    const parsed = delegationAcceptedResponseSchema.safeParse(data)
    if (parsed.success && !parsed.data.success) {
        throw new Error('Card delegation was rejected')
    }
}

export type PostAlgorandDelegationApprovalParams = {
    network: Network
    /** Delegator (funding-source) address whose spending is being delegated. */
    address: string
    /** Currency code as Baanx expects it, e.g. "usdc". */
    currency: string
    /** Transaction id of the on-chain card creation, from the backend create-card response. */
    txId: string
    /** ARC-60 SIWA sign data whose payload carries the delegation token's nonce. */
    signData: CardSiwaSignData
    /** Base64 ed25519 signature over `sha256(data) || sha256(authData)`. */
    signature: string
    /** Single-use token from GET /v1/delegation/token. */
    token: string
    signal?: AbortSignal
}

/**
 * Registers the delegated wallet with Baanx, completing card creation. The
 * amount is fixed at "0": Algorand spending is bounded by the signed AutoDraw
 * LogicSig and the Killswitch app, not by an allowance, and Baanx's Algorand
 * reference client sends "0" too.
 *
 * A replay of a lost response resolves rather than throwing — the delegation is
 * registered either way.
 */
export const postAlgorandDelegationApproval = async (
    params: PostAlgorandDelegationApprovalParams,
): Promise<void> => {
    const {
        network,
        address,
        currency,
        txId,
        signData,
        signature,
        token,
        signal,
    } = params

    try {
        const response = await getCardTransport().request({
            network,
            method: 'POST',
            path: '/v1/delegation/algorand/post-approval',
            authenticated: true,
            data: {
                address,
                network: 'algorand',
                currency,
                amount: '0',
                txHash: txId,
                signData,
                signature,
                token,
            },
            signal,
        })
        assertAccepted(response.data)
    } catch (error) {
        const apiError = await getCardApiError(error)
        if (isAlreadyCreatedError(apiError)) return
        throw error
    }
}

export type PostDelegatorLsigParams = {
    network: Network
    /** Token SYMBOL the LogicSig covers, e.g. "usdc" — not the delegation token. */
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
 * Persists the signed AutoDraw LogicSig with Baanx, keyed by the delegator that
 * signed it. The delegation signature is itself the ownership proof, so no
 * separate SIWA signature accompanies it. Registered once per wallet and
 * currency.
 */
export const postDelegatorLsig = async (
    params: PostDelegatorLsigParams,
): Promise<void> => {
    const { network, token, delegatorAddress, lsigBytes, cardAddress, signal } =
        params

    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path: '/v1/delegation/algorand/delegator-lsig',
        authenticated: true,
        data: {
            token,
            delegatorAddress,
            lsigBytes,
            cardAddress,
            blockchain: 'algorand',
        },
        signal,
    })

    assertAccepted(response.data)
}
