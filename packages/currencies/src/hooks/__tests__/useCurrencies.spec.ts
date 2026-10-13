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

import { describe, it, expect } from 'vitest'
import {
    queryKeyReferencesScope,
    scopeForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import { currencyQueryKeys, getCurrenciesQueryKey } from '../querykeys'

const MAINNET = scopeForLegacyNetwork('mainnet')

describe('getCurrenciesQueryKey', () => {
    it('returns correct query keys', () => {
        const keys = getCurrenciesQueryKey(MAINNET)
        expect(keys).toEqual(['currencies', { scope: MAINNET }])
    })
})

describe('currencyQueryKeys', () => {
    it('nests the ALGO/USD price under the assets prices namespace with its scope', () => {
        expect(currencyQueryKeys.algoUsdPrice(MAINNET)).toEqual([
            'assets',
            'prices',
            'algo-usd',
            { scope: MAINNET },
        ])
    })

    it('every key references its scope', () => {
        for (const key of [
            currencyQueryKeys.list(MAINNET),
            currencyQueryKeys.price(MAINNET, 'EUR'),
            currencyQueryKeys.algoUsdPrice(MAINNET),
        ]) {
            expect(queryKeyReferencesScope(key, MAINNET)).toBe(true)
            expect(
                queryKeyReferencesScope(key, scopeForLegacyNetwork('testnet')),
            ).toBe(false)
        }
    })
})
