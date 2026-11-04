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

import { describe, expect, it } from 'vitest'
import type { SwapAsset, SwapHistoryItem, SwapStatus } from '../../models'
import { distinctSwapPairs } from '../distinctSwapPairs'

const asset = (assetId: string): SwapAsset => ({
    ref: { chainId: 'algorand', networkId: 'mainnet', assetId },
    assetId,
    verificationTier: 'verified',
    crossChainAssetGroup: null,
})

const row = (
    orderId: string,
    pair: [string, string] | null,
    createdAt: string,
    status: SwapStatus = 'completed',
): SwapHistoryItem => ({
    orderId,
    provider: 'p',
    status,
    assetIn: pair ? asset(pair[0]) : null,
    assetOut: pair ? asset(pair[1]) : null,
    amountIn: null,
    amountOut: null,
    amountInUsdValue: null,
    amountOutUsdValue: null,
    transactions: [],
    fundingMethod: null,
    createdAt,
    updatedAt: createdAt,
})

describe('distinctSwapPairs', () => {
    it('keeps the newest completed swap of each pair, newest first', () => {
        const pairs = distinctSwapPairs(
            [
                row('1', ['0', '7'], '2026-10-01T10:00:00Z'),
                row('2', ['0', '7'], '2026-10-03T10:00:00Z'),
                row('3', ['7', '0'], '2026-10-02T10:00:00Z'),
                row('4', ['0', '9'], '2026-10-04T10:00:00Z', 'failed'),
                row('5', null, '2026-10-05T10:00:00Z'),
            ],
            10,
        )

        expect(pairs.map(pair => pair.swapDatetime)).toEqual([
            '2026-10-03T10:00:00Z',
            '2026-10-02T10:00:00Z',
        ])
        expect(pairs[0].pairKey).toBe('algorand/0|algorand/7')
    })

    it('stops at the limit', () => {
        const pairs = distinctSwapPairs(
            [
                row('1', ['0', '7'], '2026-10-01T10:00:00Z'),
                row('2', ['0', '8'], '2026-10-02T10:00:00Z'),
            ],
            1,
        )

        expect(pairs).toHaveLength(1)
        expect(pairs[0].assetOut.assetId).toBe('8')
    })
})
