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

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { decode, encode } from '../adapter/decimal-codec'

describe('decimal-codec', () => {
    it('round-trips a Decimal preserving full precision beyond 2^53', () => {
        // Algorand asset IDs and token totals routinely exceed 2^53 —
        // native JS number would lose digits, which is the precise
        // failure mode the codec exists to prevent.
        const big = new Decimal('123456789012345678901234567890.123456789')
        const value = { amount: big }

        const encoded = encode(value)
        const decoded = decode<typeof value>(encoded)

        expect(decoded.amount).toBeInstanceOf(Decimal)
        expect(decoded.amount.toString()).toBe(big.toString())
    })

    it('round-trips nested Decimals inside arrays and objects', () => {
        const value = {
            label: 'wallet',
            balances: [new Decimal('1.23'), new Decimal('4.56')],
            nested: {
                min: new Decimal('0.0000000001'),
                meta: { label: 'nested' },
            },
        }

        const decoded = decode<typeof value>(encode(value))

        expect(decoded.balances[0]).toBeInstanceOf(Decimal)
        expect(decoded.balances[0].toString()).toBe('1.23')
        expect(decoded.balances[1].toString()).toBe('4.56')
        expect(decoded.nested.min).toBeInstanceOf(Decimal)
        expect(decoded.nested.min.toString()).toBe('1e-10')
        expect(decoded.nested.meta.label).toBe('nested')
    })

    it('leaves plain strings, numbers, nulls, and booleans untouched', () => {
        const value = {
            s: 'hello',
            n: 42,
            b: true,
            maybe: null,
            items: [1, 2, 3],
        }

        const decoded = decode<typeof value>(encode(value))

        expect(decoded).toEqual(value)
    })

    it('does not mistake an arbitrary object with a `__d` property for a Decimal', () => {
        // The reviver deliberately requires the object to have EXACTLY one
        // key named `__d`. Any object with extra keys should be left alone.
        const value = { label: 'ok', __d: 'not really a decimal', extra: 1 }

        const decoded = decode<typeof value>(encode(value))

        expect(decoded.label).toBe('ok')
        expect(decoded.__d).toBe('not really a decimal')
        expect(decoded.extra).toBe(1)
    })
})
