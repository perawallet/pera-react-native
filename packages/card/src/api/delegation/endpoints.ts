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

import { decodeFromBase64, type Network } from '@perawallet/wallet-core-shared'
import { getCardTransport } from '../transport'
import type { CardDelegationToken, CardExternalWallet } from '../../models'
import {
    algorandPostApprovalResponseSchema,
    delegationProgramResponseSchema,
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

// ─── SWAP POINT: Baanx Algorand delegation contract (not shipped) ───────────
// See schema.ts — both routes below are assumed; update alongside it.

/** ASSUMED: the compiled delegation program comes from the chain-config route. */
export const fetchDelegationProgram = async (
    params: DelegationRequestParams,
): Promise<Uint8Array> => {
    const { network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'GET',
        path: '/v1/delegation/chain/config',
        params: { network: 'algorand' },
        authenticated: true,
        signal,
    })

    const { program } = delegationProgramResponseSchema.parse(response.data)
    return decodeFromBase64(program)
}

export type PostAlgorandDelegationApprovalParams = {
    network: Network
    /** Delegator (linked funding-source) address. */
    address: string
    /** Allowance as a decimal string in display units; "0" cancels. */
    amount: string
    /** Currency code as Baanx expects it, e.g. "usdc". */
    currency: string
    /** Single-use token from GET /v1/delegation/token. */
    token: string
    /** Base64 msgpack-encoded signed LogicSig. */
    signedProgram: string
    /**
     * Single-use nonce from GET /v1/delegation/token, echoed back for token
     * matching — NOT part of the signed bytes (the signature covers only
     * "Program" || program), so it binds nothing cryptographically. SWAP POINT:
     * the real contract may require the nonce inside the signed program.
     */
    sigMessage: string
    signal?: AbortSignal
}

/** ASSUMED: mirrors the EVM/Solana post-approval with the LSig as proof. */
export const postAlgorandDelegationApproval = async (
    params: PostAlgorandDelegationApprovalParams,
): Promise<void> => {
    const {
        network,
        address,
        amount,
        currency,
        token,
        signedProgram,
        sigMessage,
        signal,
    } = params

    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path: '/v1/delegation/algorand/post-approval',
        authenticated: true,
        data: {
            address,
            network: 'algorand',
            currency,
            amount,
            token,
            signedProgram,
            sigMessage,
        },
        signal,
    })

    const { success } = algorandPostApprovalResponseSchema.parse(response.data)
    if (!success) {
        throw new Error('Card delegation was rejected')
    }
}
// ─── END SWAP POINT ──────────────────────────────────────────────────────────
