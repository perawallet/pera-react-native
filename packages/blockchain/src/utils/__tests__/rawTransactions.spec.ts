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
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    TX_PREFIX,
    addTxPrefix,
    stripTxPrefix,
    rawTransactionsMatch,
} from '../rawTransactions'

const b64 = (bytes: number[]) => encodeToBase64(new Uint8Array(bytes))

describe('utils/rawTransactions', () => {
    describe('TX_PREFIX', () => {
        it('is the ASCII bytes for "TX"', () => {
            expect(Array.from(TX_PREFIX)).toEqual([0x54, 0x58])
        })
    })

    describe('addTxPrefix / stripTxPrefix', () => {
        it('round-trips', () => {
            const raw = new Uint8Array([1, 2, 3])
            const prefixed = addTxPrefix(raw)

            expect(Array.from(prefixed)).toEqual([0x54, 0x58, 1, 2, 3])
            expect(Array.from(stripTxPrefix(prefixed))).toEqual([1, 2, 3])
        })

        it('strip leaves un-prefixed bytes unchanged', () => {
            const raw = new Uint8Array([1, 2, 3])
            expect(stripTxPrefix(raw)).toBe(raw)
        })

        it('strip only matches a full "TX" prefix, not a lone 0x54', () => {
            const raw = new Uint8Array([0x54, 1, 2])
            expect(Array.from(stripTxPrefix(raw))).toEqual([0x54, 1, 2])
        })
    })

    describe('rawTransactionsMatch', () => {
        it('true for byte-identical lists in order', () => {
            const a = [b64([1, 2]), b64([3, 4])]
            const b = [b64([1, 2]), b64([3, 4])]
            expect(rawTransactionsMatch(a, b)).toBe(true)
        })

        it('compares decoded bytes, not the base64 strings', () => {
            // Distinct base64 texts that decode to the same single byte 0x00
            // ("AA==" canonical, "AA=" tolerated) still match.
            expect(rawTransactionsMatch(['AA=='], ['AA=='])).toBe(true)
            // Different bytes do not.
            expect(rawTransactionsMatch(['AA=='], ['AQ=='])).toBe(false)
        })

        it('false when order differs', () => {
            const a = [b64([1, 2]), b64([3, 4])]
            const b = [b64([3, 4]), b64([1, 2])]
            expect(rawTransactionsMatch(a, b)).toBe(false)
        })

        it('false when lengths differ', () => {
            expect(rawTransactionsMatch([b64([1])], [])).toBe(false)
        })

        it('false when an entry fails to decode', () => {
            expect(rawTransactionsMatch(['@@@@'], [b64([1])])).toBe(false)
        })
    })
})
