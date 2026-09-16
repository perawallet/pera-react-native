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

import { isHTTPError } from 'ky'
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import { getCardTransport } from '../transport'
import type {
    CardWalletBalance,
    CardWalletKind,
    WalletWithdrawEstimation,
    WalletWithdrawResult,
} from '../../models'
import {
    walletBalanceResponseSchema,
    walletWithdrawEstimationResponseSchema,
    walletWithdrawResponseSchema,
} from './schema'
import {
    transformWalletBalance,
    transformWalletWithdrawEstimation,
    transformWalletWithdraw,
} from './transformers'

export type WalletParams = {
    kind: CardWalletKind
    network: Network
    signal?: AbortSignal
}

const walletPath = (kind: CardWalletKind): string => `/v1/wallet/${kind}`

/**
 * Null until the wallet exists: Baanx only creates it when the first reward
 * or refund is credited, and answers 404 "Wallet not found" until then. That
 * is the normal state for a new card, not a failure.
 */
export const fetchWalletBalance = async (
    params: WalletParams,
): Promise<Nullable<CardWalletBalance>> => {
    try {
        const response = await getCardTransport().request({
            network: params.network,
            method: 'GET',
            path: walletPath(params.kind),
            authenticated: true,
            signal: params.signal,
        })
        return transformWalletBalance(
            walletBalanceResponseSchema.parse(response.data),
        )
    } catch (error) {
        if (isHTTPError(error) && error.response?.status === 404) return null
        throw error
    }
}

export const fetchWalletWithdrawEstimation = async (
    params: WalletParams,
): Promise<WalletWithdrawEstimation> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'GET',
        path: `${walletPath(params.kind)}/withdraw-estimation`,
        authenticated: true,
        signal: params.signal,
    })
    return transformWalletWithdrawEstimation(
        walletWithdrawEstimationResponseSchema.parse(response.data),
    )
}

export type WithdrawWalletBalanceParams = WalletParams & {
    /** Decimal string in display units (e.g. "10.5"). */
    amount: string
}
export const withdrawWalletBalance = async (
    params: WithdrawWalletBalanceParams,
): Promise<WalletWithdrawResult> => {
    const response = await getCardTransport().request({
        network: params.network,
        method: 'POST',
        path: `${walletPath(params.kind)}/withdraw`,
        authenticated: true,
        data: { amount: params.amount },
        signal: params.signal,
    })
    return transformWalletWithdraw(
        walletWithdrawResponseSchema.parse(response.data),
    )
}
