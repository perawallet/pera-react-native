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
import {
    queryKeyReferencesScope,
    scopeForLegacyNetwork,
} from '@perawallet/wallet-core-chain-contract'
import { onrampQueryKeys } from '../querykeys'

const mainnet = scopeForLegacyNetwork('mainnet')
const testnet = scopeForLegacyNetwork('testnet')

describe('onramp/hooks/querykeys', () => {
    test('every scoped builder carries the scope object in its key', () => {
        const keys = [
            onrampQueryKeys.pairs(['algo'], mainnet),
            onrampQueryKeys.region(mainnet),
            onrampQueryKeys.history('device-1', 'ADDR', undefined, mainnet),
        ]

        for (const key of keys) {
            expect(queryKeyReferencesScope(key, mainnet)).toBe(true)
            expect(queryKeyReferencesScope(key, testnet)).toBe(false)
        }
    })

    test('keeps the prefix and sub-key in the first two positions', () => {
        expect(onrampQueryKeys.region(mainnet)).toEqual([
            'onramp',
            'region',
            { scope: mainnet },
        ])
        expect(onrampQueryKeys.pairs(['algo'], mainnet)).toEqual([
            'onramp',
            'pairs',
            { destinationTokenIds: ['algo'], scope: mainnet },
        ])
    })

    test('history keys extend the history root prefix', () => {
        const key = onrampQueryKeys.history(
            'device-1',
            'ADDR',
            undefined,
            mainnet,
        )

        expect(key.slice(0, 2)).toEqual(onrampQueryKeys.historyRoot())
    })
})
