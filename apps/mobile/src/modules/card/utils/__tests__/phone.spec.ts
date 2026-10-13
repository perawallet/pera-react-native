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
import { maskPhoneNumber } from '../phone'

describe('maskPhoneNumber', () => {
    it('reduces a full number to its last four digits', () => {
        expect(maskPhoneNumber('+905551234567')).toBe('••••4567')
    })

    it('ignores separators when taking the tail', () => {
        expect(maskPhoneNumber('+44 7400 846282')).toBe('••••6282')
    })

    // Masking an already-masked value would mangle it, and we do not know yet
    // which end Baanx masks.
    it.each(['+90 *** *** 4567', '+9055512****', '+44 •••• 6282'])(
        'passes an already-masked value through: %s',
        value => {
            expect(maskPhoneNumber(value)).toBe(value)
        },
    )

    // One "x" is not a mask: an extension suffix must not leak the full number.
    it('still masks a number whose only mask-like character is an extension marker', () => {
        expect(maskPhoneNumber('+1 555 0100 ext 12')).toBe('••••0012')
    })

    it.each([null, undefined, '', '   '])(
        'is null when there is nothing to show: %s',
        value => {
            expect(maskPhoneNumber(value)).toBeNull()
        },
    )

    // Revealing four of four digits would not be a mask at all.
    it('is null when the number is too short to mask meaningfully', () => {
        expect(maskPhoneNumber('4567')).toBeNull()
    })
})
