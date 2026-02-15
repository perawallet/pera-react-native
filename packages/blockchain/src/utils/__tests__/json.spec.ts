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

import { describe, it, expect, vi } from 'vitest'
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
})
