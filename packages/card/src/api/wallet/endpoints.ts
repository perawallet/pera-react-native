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
import type { CardInternalWallet } from '../../models'
import { internalWalletsResponseSchema, withdrawResponseSchema } from './schema'
import { transformInternalWallet } from './transformers'

// TODO(card): the internal-wallet routes are custodial-platform-only — the
// Baanx sandbox rejects them with "This route is only available for CUSTODIAL"
// (Pera's platform is non-custodial/delegation-based, which has no withdraw
// API). Kept per the documented contract; blocked on Baanx defining the
// manual-funding balance/withdraw backing for non-custodial platforms.

export type FetchInternalWalletsParams = {
    network: Network
    signal?: AbortSignal
}

export const fetchInternalWallets = async (
    params: FetchInternalWalletsParams,
): Promise<CardInternalWallet[]> => {
    const { network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'GET',
        path: '/v1/wallet/internal',
        signal,
    })

    return internalWalletsResponseSchema
        .parse(response.data)
        .map(transformInternalWallet)
}

export type WithdrawFromCardParams = {
    network: Network
    /** Decimal string in display units (e.g. "25.50" USDC). */
    amount: string
    recipientAddress: string
    recipientMemo?: string
    /** The internal wallet's address (from GET /v1/wallet/internal). */
    sourceAddress: string
    sourceMemo?: string
    /** Currency code as Baanx sent it, e.g. "usdc". */
    currency: string
    signal?: AbortSignal
}

export const withdrawFromCard = async (
    params: WithdrawFromCardParams,
): Promise<void> => {
    const {
        network,
        amount,
        recipientAddress,
        recipientMemo,
        sourceAddress,
        sourceMemo,
        currency,
        signal,
    } = params

    // `recipientAddrss` (missing 'e') is Baanx's actual wire field name — do
    // not "fix" it. Memo keys are omitted entirely when absent so Baanx's
    // validation isn't tripped by nulls.
    const data: Record<string, string> = {
        amount,
        recipientAddrss: recipientAddress,
        sourceAddress,
        currency,
    }
    if (recipientMemo !== undefined) data.recipientMemo = recipientMemo
    if (sourceMemo !== undefined) data.sourceMemo = sourceMemo

    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path: '/v1/wallet/internal/withdraw',
        data,
        signal,
    })

    const { success } = withdrawResponseSchema.parse(response.data)
    if (!success) {
        throw new Error('Card withdraw was rejected')
    }
}
