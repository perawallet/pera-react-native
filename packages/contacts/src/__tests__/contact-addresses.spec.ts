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
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import { isContactInFamily } from '../contact-addresses'

describe('isContactInFamily', () => {
    test('is true when the contact holds an address in the family', () => {
        expect(
            isContactInFamily(
                { name: 'Alice', addresses: { algorand: 'A' } },
                'algorand',
            ),
        ).toBe(true)
    })

    test('is false when the contact holds only another family', () => {
        expect(
            isContactInFamily(
                { name: 'Bob', addresses: { ['other' as ChainFamily]: 'B' } },
                'algorand',
            ),
        ).toBe(false)
    })

    test('is false for an empty address', () => {
        expect(
            isContactInFamily(
                { name: 'Carol', addresses: { algorand: '' } },
                'algorand',
            ),
        ).toBe(false)
    })
})
