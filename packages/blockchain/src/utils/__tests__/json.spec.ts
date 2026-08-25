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

import { describe, it, expect, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    algorandSafeJsonStringify,
    algorandSafeQuerySerialize,
    algorandSafeQueryParse,
} from '../json'
import { encodeAlgorandAddress } from '../addresses'

vi.mock('../addresses', () => ({
    encodeAlgorandAddress: vi.fn(
        (bytes: Uint8Array) => `ENCODED_${bytes.length}`,
    ),
}))

describe('algorandSafeJsonStringify', () => {
    it('converts bigint within safe integer range to number', () => {
        const result = algorandSafeJsonStringify({ amount: 1000n })
        const parsed = JSON.parse(result)

        expect(parsed.amount).toBe(1000)
        expect(typeof parsed.amount).toBe('number')
    })

    it('converts bigint exceeding MAX_SAFE_INTEGER to string', () => {
        const bigValue = BigInt(Number.MAX_SAFE_INTEGER) + 1n
        const result = algorandSafeJsonStringify({ amount: bigValue })
        const parsed = JSON.parse(result)

        expect(parsed.amount).toBe(bigValue.toString())
        expect(typeof parsed.amount).toBe('string')
    })

    it('converts bigint exactly at MAX_SAFE_INTEGER to number', () => {
        const result = algorandSafeJsonStringify({
            amount: BigInt(Number.MAX_SAFE_INTEGER),
        })
        const parsed = JSON.parse(result)

        expect(parsed.amount).toBe(Number.MAX_SAFE_INTEGER)
        expect(typeof parsed.amount).toBe('number')
    })

    it('converts Uint8Array to base64 string', () => {
        const bytes = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
        const result = algorandSafeJsonStringify({ data: bytes })
        const parsed = JSON.parse(result)

        expect(parsed.data).toBe(Buffer.from(bytes).toString('base64'))
    })

    it('encodes publicKey field using encodeAlgorandAddress', () => {
        const publicKey = new Uint8Array(32).fill(1)
        const result = algorandSafeJsonStringify({ publicKey })
        const parsed = JSON.parse(result)

        expect(encodeAlgorandAddress).toHaveBeenCalledWith(publicKey)
        expect(parsed.publicKey).toBe('ENCODED_32')
    })

    it('passes through strings unchanged', () => {
        const result = algorandSafeJsonStringify({ name: 'Pera' })
        const parsed = JSON.parse(result)

        expect(parsed.name).toBe('Pera')
    })

    it('passes through numbers unchanged', () => {
        const result = algorandSafeJsonStringify({ count: 42 })
        const parsed = JSON.parse(result)

        expect(parsed.count).toBe(42)
    })

    it('passes through booleans and null unchanged', () => {
        const result = algorandSafeJsonStringify({
            active: true,
            deleted: false,
            value: null,
        })
        const parsed = JSON.parse(result)

        expect(parsed.active).toBe(true)
        expect(parsed.deleted).toBe(false)
        expect(parsed.value).toBeNull()
    })

    it('handles nested objects with mixed types', () => {
        const input = {
            sender: 'ADDR',
            fee: 1000n,
            note: new Uint8Array([65, 66]),
            inner: {
                amount: BigInt(Number.MAX_SAFE_INTEGER) + 100n,
            },
        }

        const result = algorandSafeJsonStringify(input)
        const parsed = JSON.parse(result)

        expect(parsed.sender).toBe('ADDR')
        expect(parsed.fee).toBe(1000)
        expect(parsed.note).toBe(Buffer.from([65, 66]).toString('base64'))
        expect(parsed.inner.amount).toBe(
            (BigInt(Number.MAX_SAFE_INTEGER) + 100n).toString(),
        )
    })

    it('formats output with 4-space indentation', () => {
        const result = algorandSafeJsonStringify({ a: 1 })

        expect(result).toContain('    "a"')
    })

    it('converts bigint 0n to number 0', () => {
        const result = algorandSafeJsonStringify({ value: 0n })
        const parsed = JSON.parse(result)

        expect(parsed.value).toBe(0)
        expect(typeof parsed.value).toBe('number')
    })
})

describe('algorandSafeQuerySerialize / algorandSafeQueryParse', () => {
    it('round-trips bigint values', () => {
        const input = { amount: 1_500_000n, minBalance: 100_000n }
        const serialized = algorandSafeQuerySerialize(input)
        const parsed = algorandSafeQueryParse(serialized) as typeof input

        expect(parsed.amount).toBe(1_500_000n)
        expect(parsed.minBalance).toBe(100_000n)
    })

    it('round-trips bigint values exceeding MAX_SAFE_INTEGER', () => {
        const big = BigInt(Number.MAX_SAFE_INTEGER) + 100n
        const input = { value: big }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

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
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed).toEqual(input)
    })

    it('round-trips nested objects with mixed types', () => {
        const input = {
            address: 'ADDR',
            balance: { microAlgos: 5_000_000n },
            assets: [{ assetId: 123n, amount: 1000n }],
        }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

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
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed.balances).toBeInstanceOf(Map)
        expect(parsed.balances.size).toBe(2)
        expect(parsed.balances.get('ADDR1')).toEqual({ amount: 100n })
        expect(parsed.balances.get('ADDR2')).toEqual({ amount: 200n })
    })

    it('round-trips empty Map', () => {
        const input = { data: new Map() }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

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
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed.accounts).toBeInstanceOf(Map)
        const account = parsed.accounts.get('ADDR1')
        expect(account?.balance).toBe(5_000_000n)
        expect(account?.assets).toBeInstanceOf(Map)
        expect(account?.assets.get('123')).toEqual({ amount: 1000n })
    })

    it('round-trips a Uint8Array field to a real Uint8Array with identical bytes', () => {
        const bytes = [104, 105]
        const input = { note: new Uint8Array(bytes) }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.note)).toEqual(bytes)
    })

    it('round-trips a realistic transaction-detail payload with bytes and bigint together', () => {
        const input = {
            id: 'ABC',
            fee: 1000n,
            note: new Uint8Array([104, 105, 33]),
        }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed.id).toBe('ABC')
        expect(parsed.fee).toBe(1000n)
        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.note)).toEqual([104, 105, 33])
    })

    it('round-trips an empty Uint8Array to an empty Uint8Array', () => {
        const input = { note: new Uint8Array([]) }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(parsed.note.length).toBe(0)
    })

    it('round-trips Uint8Array bytes nested inside an object and inside an array', () => {
        const input = {
            wrapper: { note: new Uint8Array([1, 2, 3]) },
            list: [new Uint8Array([4, 5])],
        }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed.wrapper.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.wrapper.note)).toEqual([1, 2, 3])
        expect(parsed.list[0]).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.list[0])).toEqual([4, 5])
    })

    it('does not resurrect a plain object with numeric-string keys as a Uint8Array', () => {
        const input = { data: { 0: 104, 1: 105 } }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed.data).not.toBeInstanceOf(Uint8Array)
        expect(parsed.data).toEqual({ 0: 104, 1: 105 })
    })

    it('does not re-type a non-byte typed array as bytes', () => {
        const parsed = algorandSafeQueryParse<{ counts: unknown }>(
            algorandSafeQuerySerialize({ counts: new Int32Array([1, 2]) }),
        )

        expect(parsed.counts).not.toBeInstanceOf(Uint8Array)
        expect(parsed.counts).toEqual({ 0: 1, 1: 2 })
    })

    it('round-trips a Buffer field to a real Uint8Array with identical bytes', () => {
        const bytes = [104, 105]
        const input = { note: Buffer.from(bytes) }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.note)).toEqual(bytes)
    })

    it('round-trips a Buffer nested alongside a bigint', () => {
        const input = {
            fee: 1000n,
            note: Buffer.from([104, 105, 33]),
        }
        const parsed = algorandSafeQueryParse(
            algorandSafeQuerySerialize(input),
        ) as typeof input

        expect(parsed.fee).toBe(1000n)
        expect(parsed.note).toBeInstanceOf(Uint8Array)
        expect(Array.from(parsed.note)).toEqual([104, 105, 33])
    })

    it('still serializes a non-byte-like value through its own toJSON', () => {
        const input = { price: new Decimal('1.5') }
        const serialized = algorandSafeQuerySerialize(input)
        const parsed = JSON.parse(serialized) as { price: string }

        expect(parsed.price).toBe(input.price.toJSON())
    })
})
