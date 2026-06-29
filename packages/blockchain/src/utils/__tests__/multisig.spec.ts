/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { generateMultisigAddress } from '../multisig'
import { encodeAddress } from 'algosdk'

const makeAddress = (fill: number) => {
    const bytes = new Uint8Array(32).fill(fill)
    return encodeAddress(bytes)
}

describe('generateMultisigAddress', () => {
    const addr1 = makeAddress(1)
    const addr2 = makeAddress(2)

    test('generates a valid 58-character Algorand address', () => {
        const address = generateMultisigAddress(1, 2, [addr1, addr2])
        expect(address).toHaveLength(58)
        expect(address).toMatch(/^[A-Z2-7]{58}$/)
    })

    test('produces deterministic output for same inputs', () => {
        const result1 = generateMultisigAddress(1, 2, [addr1, addr2])
        const result2 = generateMultisigAddress(1, 2, [addr1, addr2])
        expect(result1).toBe(result2)
    })

    test('produces different address for different thresholds', () => {
        const result1 = generateMultisigAddress(1, 1, [addr1, addr2])
        const result2 = generateMultisigAddress(1, 2, [addr1, addr2])
        expect(result1).not.toBe(result2)
    })

    test('produces different address for different participant order', () => {
        const result1 = generateMultisigAddress(1, 2, [addr1, addr2])
        const result2 = generateMultisigAddress(1, 2, [addr2, addr1])
        expect(result1).not.toBe(result2)
    })
})
