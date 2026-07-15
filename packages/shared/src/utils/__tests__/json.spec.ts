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
import { parsePrecisionSafeJson, uint64IdToNumber } from '../json'

describe('parsePrecisionSafeJson', () => {
    it('parses ordinary payloads identically to JSON.parse', () => {
        const text = '{"a":1,"b":"x","c":[1.5,-2,null,true],"d":{"e":0}}'
        expect(parsePrecisionSafeJson(text)).toEqual(JSON.parse(text))
    })

    it('surfaces integers above 2^53 - 1 as decimal strings', () => {
        const big = '18446744073709551615' // uint64 max
        const parsed = parsePrecisionSafeJson(`{"asset_id":${big}}`) as {
            asset_id: unknown
        }
        expect(parsed.asset_id).toBe(big)
    })

    it('surfaces large negative integers as strings', () => {
        const parsed = parsePrecisionSafeJson('{"v":-9007199254740993}') as {
            v: unknown
        }
        expect(parsed.v).toBe('-9007199254740993')
    })

    it('keeps safe 16-digit integers as numbers', () => {
        // 1e15 has 16 digits but is exactly representable.
        const parsed = parsePrecisionSafeJson('{"v":1000000000000000}') as {
            v: unknown
        }
        expect(parsed.v).toBe(1000000000000000)
    })

    it('keeps the max safe integer as a number', () => {
        const parsed = parsePrecisionSafeJson(
            `{"v":${Number.MAX_SAFE_INTEGER}}`,
        ) as { v: unknown }
        expect(parsed.v).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('never touches digit runs inside strings', () => {
        const parsed = parsePrecisionSafeJson(
            '{"note":"id 18446744073709551615 quoted","v":12345678901234567}',
        ) as { note: string; v: unknown }
        expect(parsed.note).toBe('id 18446744073709551615 quoted')
        expect(parsed.v).toBe('12345678901234567')
    })

    it('handles escaped quotes inside strings', () => {
        const parsed = parsePrecisionSafeJson(
            '{"s":"a\\"99999999999999999\\"b","v":99999999999999999}',
        ) as { s: string; v: unknown }
        expect(parsed.s).toBe('a"99999999999999999"b')
        expect(parsed.v).toBe('99999999999999999')
    })

    it('leaves fraction and exponent literals to native double parsing', () => {
        const parsed = parsePrecisionSafeJson(
            '{"f":1234567890123456.5,"e":1e3,"v":99999999999999999}',
        ) as { f: unknown; e: unknown; v: unknown }
        expect(typeof parsed.f).toBe('number')
        expect(parsed.e).toBe(1000)
        expect(parsed.v).toBe('99999999999999999')
    })

    it('handles numbers with long fractional parts (16+ fraction digits)', () => {
        const parsed = parsePrecisionSafeJson(
            '{"price":0.12345678901234567,"neg":-1.98765432109876543,"exp":1.234567890123456e-7}',
        ) as { price: unknown; neg: unknown; exp: unknown }
        expect(parsed.price).toBe(0.12345678901234567)
        expect(parsed.neg).toBe(-1.98765432109876543)
        expect(parsed.exp).toBe(1.234567890123456e-7)
    })

    it('handles big integers in arrays and nested objects', () => {
        const parsed = parsePrecisionSafeJson(
            '{"results":[{"asset_id":18446744073709551615},{"asset_id":7}]}',
        ) as { results: Array<{ asset_id: unknown }> }
        expect(parsed.results[0].asset_id).toBe('18446744073709551615')
        expect(parsed.results[1].asset_id).toBe(7)
    })

    it('throws on invalid JSON like JSON.parse does', () => {
        expect(() => parsePrecisionSafeJson('{nope')).toThrow()
        expect(() =>
            parsePrecisionSafeJson('{"v":18446744073709551615,nope'),
        ).toThrow()
    })
})

describe('uint64IdToNumber', () => {
    it('converts string and number ids within the safe range', () => {
        expect(uint64IdToNumber('31566704')).toBe(31566704)
        expect(uint64IdToNumber(0)).toBe(0)
        expect(uint64IdToNumber(String(Number.MAX_SAFE_INTEGER))).toBe(
            Number.MAX_SAFE_INTEGER,
        )
    })

    it('throws on ids above 2^53 - 1 instead of rounding', () => {
        expect(() => uint64IdToNumber('9007199254740993')).toThrow(RangeError)
        expect(() => uint64IdToNumber('18446744073709551615')).toThrow(
            RangeError,
        )
    })

    it('throws on negative, fractional, and non-numeric input', () => {
        expect(() => uint64IdToNumber(-1)).toThrow(RangeError)
        expect(() => uint64IdToNumber('1.5')).toThrow(RangeError)
        expect(() => uint64IdToNumber('abc')).toThrow(RangeError)
        expect(() => uint64IdToNumber('')).toThrow(RangeError)
    })
})
