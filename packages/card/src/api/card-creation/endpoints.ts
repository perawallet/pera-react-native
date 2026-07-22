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
 * ARC-60 ownership proof, submits the `cardCreate` app call, and returns the
 * resulting card address and transaction id.
 */
export const createCard = async (
    params: CreateCardParams,
): Promise<CreateCardResult> => {
    const {
        network,
        address,
        currency,
        signData,
        signature,
        integrityToken,
        signal,
    } = params

    const response = await getCardTransport().request({
        network,
        route: 'proxy',
        method: 'POST',
        path: '/v3/baanx/escrow-card',
        data: { address, currency, signData, signature },
        headers: { 'x-app-integrity-token': integrityToken },
        signal,
    })

    return createCardResponseSchema.parse(response.data)
}
