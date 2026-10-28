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

// @vitest-environment node

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
    addressCodecs,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { registerLegacyAddressCodec } from '@test-utils/chain-fixtures'
import { formatDebugValue, shouldUseStackedLayout } from '../formatDebugValue'

const ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

const circularObject: Record<string, unknown> = { name: 'loop' }
circularObject.self = circularObject

const circularArray: unknown[] = []
circularArray.push(circularArray)

describe('formatDebugValue', () => {
    beforeEach(() => {
        registerLegacyAddressCodec(address => address === ADDRESS)
    })

    afterEach(() => {
        addressCodecs.reset()
        vi.restoreAllMocks()
    })

    it.each([
        ['null', null, '(null)'],
        ['undefined', undefined, '(null)'],
        ['an empty Uint8Array', new Uint8Array(0), 'Uint8Array(0) []'],
        [
            'a short Uint8Array',
            new Uint8Array([1, 171, 255]),
            'Uint8Array(3) [01 ab ff]',
        ],
        [
            'a Uint8Array longer than the preview',
            new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
            'Uint8Array(10) [00 01 02 03 04 05 06 07 …]',
        ],
        ['an empty array', [], '[]'],
        ['an array', [1, 'a', { b: true }], '[1,"a",{"b":true}]'],
        ['a circular array', circularArray, 'Array(1)'],
        ['an array holding a bigint', [1n], 'Array(1)'],
        ['true', true, 'true'],
        ['false', false, 'false'],
        ['a number', 42.5, '42.5'],
        ['an empty string', '', '""'],
        ['a plain string', 'hello', 'hello'],
        ['a bigint', 12_345_678_901_234_567_890n, '12345678901234567890'],
        [
            'a Date',
            new Date('2026-01-02T03:04:05.000Z'),
            '"2026-01-02T03:04:05.000Z"',
        ],
        ['a nested object', { a: { b: [1, 2] } }, '{"a":{"b":[1,2]}}'],
        ['a circular object', circularObject, '[Object]'],
        ['a symbol', Symbol('tag'), 'Symbol(tag)'],
    ])('formats %s', (_label, value, expected) => {
        expect(formatDebugValue(value)).toBe(expected)
    })

    it("truncates an address with its chain codec's short form", () => {
        const truncate = vi
            .spyOn(addressCodecs.get(LEGACY_CHAIN_ID), 'truncate')
            .mockReturnValueOnce('AAAA…FKQ')

        expect(formatDebugValue(ADDRESS)).toBe('AAAA…FKQ')
        expect(truncate).toHaveBeenCalledWith(ADDRESS)
    })

    it.each(['A'.repeat(58), 'a'.repeat(58), ADDRESS.toLowerCase()])(
        'leaves %s untouched: 58 characters, not an address',
        value => {
            const truncate = vi.spyOn(
                addressCodecs.get(LEGACY_CHAIN_ID),
                'truncate',
            )

            expect(formatDebugValue(value)).toBe(value)
            expect(truncate).not.toHaveBeenCalled()
        },
    )

    it('leaves an address untouched when no chain has registered a codec', () => {
        addressCodecs.reset()

        expect(formatDebugValue(ADDRESS)).toBe(ADDRESS)
    })
})

describe('shouldUseStackedLayout', () => {
    it.each([
        ['an empty Uint8Array', new Uint8Array(0), true],
        ['an empty array', [], false],
        ['a non-empty array', [1], true],
        ['a 32-character string', 'x'.repeat(32), false],
        ['a 33-character string', 'x'.repeat(33), true],
        ['an object', { a: 1 }, true],
        ['null', null, false],
        ['a number', 7, false],
        ['undefined', undefined, false],
    ])('returns the layout for %s', (_label, value, expected) => {
        expect(shouldUseStackedLayout(value)).toBe(expected)
    })
})
