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

// Stands in for a chain package's codec, which this package can't import.
export const fixtureChainData: HistoryChainDataCodec = {
    encode: item =>
        JSON.stringify({
            fixture: {
                confirmedRound: item.confirmedRound ?? null,
                roundTime: item.roundTime,
                innerTransactionCount: item.innerTransactionCount,
                applicationId: item.applicationId,
                closeTo: item.closeTo,
                groupId: item.groupId,
                closeAmount: item.closeAmount?.toString() ?? null,
                swapGroupDetail: item.swapGroupDetail
                    ? {
                          ...item.swapGroupDetail,
                          amountIn: item.swapGroupDetail.amountIn.toString(),
                          amountOut: item.swapGroupDetail.amountOut.toString(),
                      }
                    : null,
            },
        }),
    decode: json => {
        const stored = JSON.parse(json).fixture ?? {}
        return {
            confirmedRound: stored.confirmedRound ?? undefined,
            roundTime: stored.roundTime ?? 0,
            innerTransactionCount: stored.innerTransactionCount ?? null,
            applicationId: stored.applicationId ?? null,
            closeTo: stored.closeTo ?? null,
            groupId: stored.groupId ?? null,
            closeAmount: stored.closeAmount
                ? new Decimal(stored.closeAmount)
                : null,
            swapGroupDetail: stored.swapGroupDetail
                ? {
                      ...stored.swapGroupDetail,
                      amountIn: new Decimal(stored.swapGroupDetail.amountIn),
                      amountOut: new Decimal(stored.swapGroupDetail.amountOut),
                  }
                : null,
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
    toDisplayable: vi.fn(),
    chainData: fixtureChainData,
    ...overrides,
})
