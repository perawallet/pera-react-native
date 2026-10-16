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
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { currencyQueryKeys, getCurrenciesQueryKey } from '../querykeys'

const MAINNET = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const

describe('getCurrenciesQueryKey', () => {
    it.each(['live', 'developer'] as const)(
        'keys the list by the %s deployment',
        deployment => {
            expect(getCurrenciesQueryKey(deployment)).toEqual([
                'currencies',
                { deployment },
            ])
        },
    )
})

describe('currencyQueryKeys', () => {
    it('nests the native/USD price under the assets prices namespace with its scope', () => {
        expect(currencyQueryKeys.nativeUsdPrice(MAINNET)).toEqual([
            'assets',
            'prices',
            'native-usd',
            { scope: MAINNET },
        ])
    })

    it('only the native/USD price key references a scope', () => {
        expect(
            queryKeyReferencesScope(
                currencyQueryKeys.nativeUsdPrice(MAINNET),
                MAINNET,
            ),
        ).toBe(true)
        expect(
            queryKeyReferencesScope(currencyQueryKeys.nativeUsdPrice(MAINNET), {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'testnet',
            } as const),
        ).toBe(false)
        for (const key of [
            currencyQueryKeys.list('live'),
            currencyQueryKeys.price('live', 'EUR'),
        ]) {
            expect(queryKeyReferencesScope(key, MAINNET)).toBe(false)
        }
    })
})
