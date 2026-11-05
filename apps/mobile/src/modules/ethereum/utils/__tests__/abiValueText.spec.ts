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

import { Decimal } from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { abiValueText } from '../abiValueText'

const MAX_UINT256 =
    '115792089237316195423570985008687907853269984665640564039457584007913129639935'

describe('abiValueText', () => {
    it('writes an integer exactly, without grouping, rounding or exponent', () => {
        expect(
            abiValueText({ kind: 'integer', value: new Decimal(MAX_UINT256) }),
        ).toBe(MAX_UINT256)
    })

    it('writes a negative integer with its sign', () => {
        expect(abiValueText({ kind: 'integer', value: new Decimal(-5) })).toBe(
            '-5',
        )
    })

    it('writes a bool as true or false', () => {
        expect(abiValueText({ kind: 'bool', value: true })).toBe('true')
        expect(abiValueText({ kind: 'bool', value: false })).toBe('false')
    })

    it('writes bytes as hex', () => {
        expect(abiValueText({ kind: 'bytes', value: '0xdeadbeef' })).toBe(
            '0xdeadbeef',
        )
    })

    it('quotes a string so its edges are visible', () => {
        expect(abiValueText({ kind: 'string', value: ' gm ' })).toBe('" gm "')
    })
})
