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
import { normalizeListedAddresses, toListedAddressKey } from '../addresses'

const ALGORAND = 'Q4UBDMH5IVEBJTQ6NBTS5A7LKUPJDGMIIIYMWCTAT2Y5K2FTPYXUC7QRAE'

describe('toListedAddressKey', () => {
    it('gives a checksummed and a lowercase EVM address the same key', () => {
        expect(
            toListedAddressKey('0x09750ad360fdb7A2ee23669C4503c974D86D8694'),
        ).toBe(toListedAddressKey('0x09750ad360fdb7a2ee23669c4503c974d86d8694'))
    })

    it('keys an Algorand address by its lowercase form', () => {
        expect(toListedAddressKey(` ${ALGORAND} `)).toBe(ALGORAND.toLowerCase())
    })
})

describe('normalizeListedAddresses', () => {
    it('keeps EVM and Algorand addresses, drops anything else and collapses duplicates', () => {
        expect(
            normalizeListedAddresses([
                '0x09750ad360fdb7A2ee23669C4503c974D86D8694',
                '0x09750AD360FDB7A2EE23669C4503C974D86D8694',
                ALGORAND,
                '0x1234',
                'phish.example',
                '',
            ]),
        ).toEqual([
            '0x09750ad360fdb7a2ee23669c4503c974d86d8694',
            ALGORAND.toLowerCase(),
        ])
    })
})
