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
    CardWalletHistoryPage,
    CardWalletKind,
    WalletWithdrawResult,
} from '../../models'
import {
    walletBalanceResponseSchema,
    walletHistoryResponseSchema,
    walletWithdrawResponseSchema,
} from './schema'
import {
    transformWalletBalance,
    transformWalletHistoryEntry,
    transformWalletWithdraw,
} from './transformers'

export type WalletParams = {
    kind: CardWalletKind
    network: Network
    signal?: AbortSignal
}

const walletPath = (kind: CardWalletKind): string => `/v1/wallet/${kind}`

/** `walletType` values for GET /v1/wallet/history; an explicit map, not a casing rule. */
export const WALLET_TYPE_BY_KIND: Record<CardWalletKind, string> = {
    reward: 'REWARD',
    credit: 'CREDIT',
}

// Baanx returns a fixed page size and no total.
const HISTORY_PAGE_SIZE = 10

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

export type FetchWalletHistoryParams = WalletParams & {
    /** The wallet's `id` from GET /v1/wallet/{kind}. */
    walletId: string
    /** Zero-indexed page. */
    page?: number
}
export const fetchWalletHistory = async (
    params: FetchWalletHistoryParams,
): Promise<CardWalletHistoryPage> => {
    const { kind, walletId, page = 0, network, signal } = params
    const response = await getCardTransport().request({
        network,
        method: 'GET',
        path: '/v1/wallet/history',
        authenticated: true,
        params: { walletId, walletType: WALLET_TYPE_BY_KIND[kind], page },
        signal,
    })
    const items = walletHistoryResponseSchema
        .parse(response.data)
        .map(transformWalletHistoryEntry)
    // A short page is the last one; a full page may or may not be.
    return { items, page, hasMore: items.length === HISTORY_PAGE_SIZE }
}
