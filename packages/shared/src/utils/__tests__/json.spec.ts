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
import { Decimal } from 'decimal.js'
import {
    parsePrecisionSafeJson,
    parseTypedJson,
    stringifyTypedJson,
    uint64IdToNumber,
} from '../json'

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

describe('stringifyTypedJson / parseTypedJson', () => {
    it('round-trips bigint values', () => {
        const input = { amount: 1_500_000n, minBalance: 100_000n }
        const serialized = stringifyTypedJson(input)
        const parsed = parseTypedJson(serialized) as typeof input

        expect(parsed.amount).toBe(1_500_000n)
        expect(parsed.minBalance).toBe(100_000n)
    })

    it('round-trips bigint values exceeding MAX_SAFE_INTEGER', () => {
        const big = BigInt(Number.MAX_SAFE_INTEGER) + 100n
        const input = { value: big }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.value).toBe(big)
    })

    it('preserves non-bigint types', () => {
        const input = {
            name: 'Pera',
            count: 42,
            active: true,
            items: [1, 2, 3],
            nested: { key: 'val' },
        }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed).toEqual(input)
    })

    it('round-trips nested objects with mixed types', () => {
        const input = {
            address: 'ADDR',
            balance: { microAlgos: 5_000_000n },
            assets: [{ assetId: 123n, amount: 1000n }],
        }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.address).toBe('ADDR')
        expect(parsed.balance.microAlgos).toBe(5_000_000n)
        expect(parsed.assets[0].assetId).toBe(123n)
        expect(parsed.assets[0].amount).toBe(1000n)
    })

    it('round-trips Map objects', () => {
        const input = {
            balances: new Map([
                ['ADDR1', { amount: 100n }],
                ['ADDR2', { amount: 200n }],
            ]),
        }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.balances).toBeInstanceOf(Map)
        expect(parsed.balances.size).toBe(2)
        expect(parsed.balances.get('ADDR1')).toEqual({ amount: 100n })
        expect(parsed.balances.get('ADDR2')).toEqual({ amount: 200n })
    })

    it('round-trips empty Map', () => {
        const input = { data: new Map() }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.data).toBeInstanceOf(Map)
        expect(parsed.data.size).toBe(0)
    })

    it('round-trips nested Maps with bigint values', () => {
        const input = {
            accounts: new Map([
                [
                    'ADDR1',
                    {
                        balance: 5_000_000n,
                        assets: new Map([['123', { amount: 1000n }]]),
                    },
                ],
            ]),
        }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.accounts).toBeInstanceOf(Map)
        const account = parsed.accounts.get('ADDR1')
        expect(account?.balance).toBe(5_000_000n)
        expect(account?.assets).toBeInstanceOf(Map)
        expect(account?.assets.get('123')).toEqual({ amount: 1000n })
    })

    it('round-trips a Uint8Array field to a real Uint8Array with identical bytes', () => {
        const bytes = [104, 105]
        const input = { note: new Uint8Array(bytes) }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.note)).toEqual(bytes)
    })

    it('round-trips a realistic transaction-detail payload with bytes and bigint together', () => {
        const input = {
            id: 'ABC',
            fee: 1000n,
            note: new Uint8Array([104, 105, 33]),
        }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.id).toBe('ABC')
        expect(parsed.fee).toBe(1000n)
        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.note)).toEqual([104, 105, 33])
    })

    it('round-trips an empty Uint8Array to an empty Uint8Array', () => {
        const input = { note: new Uint8Array([]) }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(parsed.note.length).toBe(0)
    })

    it('round-trips Uint8Array bytes nested inside an object and inside an array', () => {
        const input = {
            wrapper: { note: new Uint8Array([1, 2, 3]) },
            list: [new Uint8Array([4, 5])],
        }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.wrapper.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.wrapper.note)).toEqual([1, 2, 3])
        expect(parsed.list[0]).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.list[0])).toEqual([4, 5])
    })

    it('does not resurrect a plain object with numeric-string keys as a Uint8Array', () => {
        const input = { data: { 0: 104, 1: 105 } }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.data).not.toBeInstanceOf(Uint8Array)
        expect(parsed.data).toEqual({ 0: 104, 1: 105 })
    })

    it('does not re-type a non-byte typed array as bytes', () => {
        const parsed = parseTypedJson<{ counts: unknown }>(
            stringifyTypedJson({ counts: new Int32Array([1, 2]) }),
        )

        expect(parsed.counts).not.toBeInstanceOf(Uint8Array)
        expect(parsed.counts).toEqual({ 0: 1, 1: 2 })
    })

    it('round-trips a Buffer field to a real Uint8Array with identical bytes', () => {
        const bytes = [104, 105]
        const input = { note: Buffer.from(bytes) }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.note)).toEqual(bytes)
    })

    it('round-trips a Buffer nested alongside a bigint', () => {
        const input = {
            fee: 1000n,
            note: Buffer.from([104, 105, 33]),
        }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.fee).toBe(1000n)
        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.note)).toEqual([104, 105, 33])
    })

    it('round-trips a Decimal field to a real Decimal with the same value', () => {
        const input = { usdPrice: new Decimal('0.85') }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(Decimal.isDecimal(parsed.usdPrice)).toBe(true)
        expect(parsed.usdPrice.isZero()).toBe(false)
        expect(parsed.usdPrice.toString()).toBe('0.85')
    })

    it('round-trips Decimals nested inside arrays alongside bigint and bytes', () => {
        const input = {
            fee: 1000n,
            note: new Uint8Array([1, 2]),
            history: [{ usdPrice: new Decimal('12345678.123456789') }],
            zero: new Decimal(0),
        }
        const parsed = parseTypedJson(stringifyTypedJson(input)) as typeof input

        expect(parsed.fee).toBe(1000n)
        expect(Array.from(parsed.note)).toEqual([1, 2])
        expect(Decimal.isDecimal(parsed.history[0].usdPrice)).toBe(true)
        expect(parsed.history[0].usdPrice.toString()).toBe('12345678.123456789')
        expect(parsed.zero.isZero()).toBe(true)
    })

    it('does not resurrect a plain string that merely looks numeric as a Decimal', () => {
        const parsed = parseTypedJson(
            stringifyTypedJson({ id: 'EUR', code: '0.85' }),
        ) as { id: string; code: string }

        expect(typeof parsed.code).toBe('string')
        expect(parsed.code).toBe('0.85')
    })

    it('restores every tag from a payload persisted before the move', () => {
        const parsed = parseTypedJson(
            '{"a":"__bigint__1","b":{"__bytes__":"AQI="},"m":{"__map__":[["k","__bigint__2"]]},"d":{"__decimal__":"1.5"}}',
        ) as { a: bigint; b: Uint8Array; m: Map<string, bigint>; d: Decimal }

        expect(parsed.a).toBe(1n)
        expect(Array.from(parsed.b)).toEqual([1, 2])
        expect(parsed.m.get('k')).toBe(2n)
        expect(parsed.d.toString()).toBe('1.5')
    })

    it('writes the persisted tag format byte for byte', () => {
        expect(
            stringifyTypedJson({
                a: 1n,
                b: new Uint8Array([1, 2]),
                m: new Map([['k', 2n]]),
                d: new Decimal('1.5'),
            }),
        ).toBe(
            '{"a":"__bigint__1","b":{"__bytes__":"AQI="},"m":{"__map__":[["k","__bigint__2"]]},"d":{"__decimal__":"1.5"}}',
        )
    })
})
