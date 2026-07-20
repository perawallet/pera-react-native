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
import { getCardTransport } from '../transport'
import {
    delegatorLsigResponseSchema,
    escrowCardCreationResponseSchema,
} from './schema'
import type { EscrowSiwaSignData } from './siwa'

// ─── SWAP POINT: AppliedBlockchain (AB) escrow card service ─────────────────
// Both calls go to AB's server (route: 'escrow') until Baanx wraps them. The
// `blockchain: 'algorand'` discriminator and the request shapes mirror AB's
// demo client; only this block, schema.ts, and the dev mock change when the
// production contract is finalized.

export type CreateEscrowCardParams = {
    network: Network
    /** Funding-source (delegator) address the escrow card is created for. */
    address: string
    /** Settlement currency as AB expects it, e.g. "usdc". */
    currency: string
    /** ARC-60 SIWA sign data (base64 payload + domain hash). */
    signData: EscrowSiwaSignData
    /** Base64 ed25519 signature over `"MX" || (sha256(data) || authData)`. */
    signature: string
    signal?: AbortSignal
}

/**
 * Records the card-creation approval with AB, which performs the on-chain
 * `cardCreate` and returns the created escrow card address.
 *
 * The demo additionally sends `transaction: { hash }` from its client-side
 * on-chain create (deployer-signed, demo-only). Production clients cannot sign
 * `cardCreate` (it is owner-only), so we send the user address and omit
 * `transaction` — the server owns the on-chain leg. `amount` is "0": card
 * creation funds nothing.
 */
export const createEscrowCard = async (
    params: CreateEscrowCardParams,
): Promise<{ cardAddress: string }> => {
    const { network, address, currency, signData, signature, signal } = params

    const response = await getCardTransport().request({
        network,
        route: 'escrow',
        method: 'POST',
        path: '/api/approvals',
        data: {
            address,
            currency,
            amount: '0',
            signData,
            signature,
            blockchain: 'algorand',
        },
        signal,
    })

    return escrowCardCreationResponseSchema.parse(response.data)
}

export type PostDelegatorLsigParams = {
    network: Network
    /** Token SYMBOL AB keys the delegation by, e.g. "usdc". */
    token: string
    /** Delegator (funding-source) address that signed the LogicSig. */
    delegatorAddress: string
    /** Base64 msgpack-encoded signed delegated LogicSigAccount. */
    lsigBytes: string
    /** Escrow card address returned by {@link createEscrowCard}. */
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

    return delegatorLsigResponseSchema.parse(response.data)
}
// ─── END SWAP POINT ──────────────────────────────────────────────────────────
