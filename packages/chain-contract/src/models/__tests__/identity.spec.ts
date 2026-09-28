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
import { CHAIN_IDS, isChainId, isNetworkId } from '../identity'

describe('isChainId', () => {
    it.each(CHAIN_IDS)('accepts %s', chainId => {
        expect(isChainId(chainId)).toBe(true)
    })

    it.each(['', 'Algorand', 'unknown', 'algorand/mainnet', 'algorand '])(
        'rejects %j',
        value => {
            expect(isChainId(value)).toBe(false)
        },
    )

    it.each([undefined, null, 0, {}])('rejects the non-string %j', value => {
        expect(isChainId(value)).toBe(false)
    })
})

describe('isNetworkId', () => {
    it.each(['mainnet', 'custom-9f3a', 'a-b-c', '0'])('accepts %s', value => {
        expect(isNetworkId(value)).toBe(true)
    })

    it.each([
        '',
        'MainNet',
        'main net',
        'main_net',
        'main/net',
        'mainnet\n',
        ' mainnet',
    ])('rejects %j', value => {
        expect(isNetworkId(value)).toBe(false)
    })

    it.each([undefined, null, 1, {}])('rejects the non-string %j', value => {
        expect(isNetworkId(value)).toBe(false)
    })
})
