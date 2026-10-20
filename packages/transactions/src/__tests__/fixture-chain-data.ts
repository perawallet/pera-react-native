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

import { vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { TransactionHistoryItem } from '../models/types'
import type {
    HistoryChainAdapter,
    HistoryChainDataCodec,
} from '../history-adapter'

export const FIXTURE_PATHS = {
    closeTo: '$.fixture.closeTo',
    closeAmount: '$.fixture.closeAmount',
    swapGroupDetail: '$.fixture.swapGroupDetail',
    swapAssetInDecimals: '$.fixture.swapGroupDetail.assetInDecimals',
} as const

/** The only chain facts the repository specs read, standing in for a chain's own member. */
export type FixtureChainData = {
    closeTo: Nullable<string>
    closeAmount: Nullable<Decimal>
    swapGroupDetail: Nullable<{
        assetInId: Nullable<string>
        amountIn: Decimal
        amountOut: Decimal
        [key: string]: unknown
    }>
}

export const fixtureChainDataOf = (
    data: Partial<FixtureChainData> = {},
): FixtureChainData => ({
    closeTo: null,
    closeAmount: null,
    swapGroupDetail: null,
    ...data,
})

export const fixtureDataOf = (
    item: Pick<TransactionHistoryItem, 'chainData'>,
): FixtureChainData => fixtureChainDataOf(item.chainData as FixtureChainData)

// Stands in for a chain package's codec, which this package can't import.
export const fixtureChainData: HistoryChainDataCodec = {
    encode: ({ confirmedRound, roundTime, chainData }) => {
        const data = fixtureChainDataOf(chainData as FixtureChainData)
        return JSON.stringify({
            fixture: {
                confirmedRound: confirmedRound ?? null,
                roundTime,
                closeTo: data.closeTo,
                closeAmount: data.closeAmount?.toString() ?? null,
                swapGroupDetail: data.swapGroupDetail
                    ? {
                          ...data.swapGroupDetail,
                          amountIn: data.swapGroupDetail.amountIn.toString(),
                          amountOut: data.swapGroupDetail.amountOut.toString(),
                      }
                    : null,
            },
        })
    },
    decode: json => {
        const stored = JSON.parse(json).fixture ?? {}
        return {
            confirmedRound: stored.confirmedRound ?? undefined,
            roundTime: stored.roundTime ?? 0,
            chainData: fixtureChainDataOf({
                closeTo: stored.closeTo ?? null,
                closeAmount: stored.closeAmount
                    ? new Decimal(stored.closeAmount)
                    : null,
                swapGroupDetail: stored.swapGroupDetail
                    ? {
                          ...stored.swapGroupDetail,
                          amountIn: new Decimal(
                              stored.swapGroupDetail.amountIn,
                          ),
                          amountOut: new Decimal(
                              stored.swapGroupDetail.amountOut,
                          ),
                      }
                    : null,
            }),
        }
    },
    assetIdPaths: [
        '$.fixture.swapGroupDetail.assetInId',
        '$.fixture.swapGroupDetail.assetOutId',
    ],
    stickyPaths: [FIXTURE_PATHS.closeAmount],
}

export const fixtureHistoryAdapter = (
    overrides: Partial<HistoryChainAdapter> = {},
): HistoryChainAdapter => ({
    chainId: 'algorand',
    fetchHistory: vi.fn(),
    fetchMoreHistory: vi.fn(),
    getTransactionHistory: vi.fn(),
    summarize: vi.fn(),
    toTransactionNative: vi.fn(),
    chainData: fixtureChainData,
    ...overrides,
})
