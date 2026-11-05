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

import { describe, test, expect } from 'vitest'
import type { Query } from '@tanstack/react-query'
import { queryKeyReferencesScope } from '@perawallet/wallet-core-chain-contract'
import { getInvalidateSwapHistoryPredicate, swapQueryKeys } from '../querykeys'

const mainnet = { chainId: 'algorand', networkId: 'mainnet' } as const
const testnet = { chainId: 'algorand', networkId: 'testnet' } as const

describe('swaps/hooks/querykeys', () => {
    test('every builder carries the scope object in its key', () => {
        const keys = [
            swapQueryKeys.pairs(
                { ...mainnet, assetId: 'native' },
                'q',
                mainnet,
            ),
            swapQueryKeys.historyInfinite('ADDR', mainnet),
            swapQueryKeys.distinctPairsHistory('ADDR', mainnet),
        ]

        for (const key of keys) {
            expect(queryKeyReferencesScope(key, mainnet)).toBe(true)
            expect(queryKeyReferencesScope(key, testnet)).toBe(false)
        }
    })

    test('keeps the prefix and sub-key in the first two positions', () => {
        expect(swapQueryKeys.historyInfinite('ADDR', mainnet)).toEqual([
            'swaps',
            'history-infinite',
            { address: 'ADDR', scope: mainnet },
        ])
    })

    test('the swap-history predicate matches history only', () => {
        const matches = (queryKey: readonly unknown[]) =>
            getInvalidateSwapHistoryPredicate({ queryKey } as unknown as Query)

        expect(matches(swapQueryKeys.historyInfinite('ADDR', mainnet))).toBe(
            true,
        )
        expect(
            matches(swapQueryKeys.distinctPairsHistory('ADDR', mainnet)),
        ).toBe(true)
        expect(matches(swapQueryKeys.pairs(null, undefined, mainnet))).toBe(
            false,
        )
    })
})
