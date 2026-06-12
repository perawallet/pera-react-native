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
import { partition, partitionBy, concatBytes, bytesEqual } from '../arrays'

describe('utils/arrays', () => {
    describe('partition', () => {
        test('partitions array into chunks of specified size', () => {
            const array = [1, 2, 3, 4, 5, 6, 7, 8, 9]
            const result = partition(array, 3)
            expect(result).toEqual([
                [1, 2, 3],
                [4, 5, 6],
                [7, 8, 9],
            ])
        })

        test('handles array not evenly divisible by chunk size', () => {
            const array = [1, 2, 3, 4, 5, 6, 7]
            const result = partition(array, 3)
            expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]])
        })

        test('handles empty array', () => {
            expect(partition([], 3)).toEqual([])
        })

        test('handles chunk size larger than array', () => {
            expect(partition([1, 2, 3], 10)).toEqual([[1, 2, 3]])
        })
    })

    describe('partitionBy', () => {
        test('groups items by the string returned from the predicate', () => {
            const items = [
                { id: 1, net: 'mainnet' },
                { id: 2, net: 'testnet' },
                { id: 3, net: 'mainnet' },
            ]
            const result = partitionBy(items, i => i.net)

            expect(result).toHaveLength(2)
            const groups = new Map(result.map(g => [g[0].net, g]))
            expect(groups.get('mainnet')).toEqual([
                { id: 1, net: 'mainnet' },
                { id: 3, net: 'mainnet' },
            ])
            expect(groups.get('testnet')).toEqual([{ id: 2, net: 'testnet' }])
        })

        test('returns an empty array for no input', () => {
            expect(partitionBy<number>([], () => 'k')).toEqual([])
        })
    })

    describe('concatBytes', () => {
        test('concatenates Uint8Arrays preserving order and bytes', () => {
            const a = new Uint8Array([1, 2, 3])
            const b = new Uint8Array([4, 5])
            const c = new Uint8Array([6])
            const result = concatBytes(a, b, c)

            expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6])
        })

        test('returns an empty Uint8Array when given no arrays', () => {
            const result = concatBytes()
            expect(result).toBeInstanceOf(Uint8Array)
            expect(result.length).toBe(0)
        })
    })

    describe('bytesEqual', () => {
        test('true for identical content', () => {
            expect(
                bytesEqual(
                    new Uint8Array([1, 2, 3]),
                    new Uint8Array([1, 2, 3]),
                ),
            ).toBe(true)
        })

        test('false when content differs', () => {
            expect(
                bytesEqual(
                    new Uint8Array([1, 2, 3]),
                    new Uint8Array([1, 2, 4]),
                ),
            ).toBe(false)
        })

        test('false when lengths differ', () => {
            expect(
                bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])),
            ).toBe(false)
        })

        test('nullish-tolerant: both absent are equal, one absent is not', () => {
            expect(bytesEqual(undefined, null)).toBe(true)
            expect(bytesEqual(new Uint8Array([1]), undefined)).toBe(false)
            expect(bytesEqual(null, new Uint8Array([1]))).toBe(false)
        })

        test('two empty arrays are equal', () => {
            expect(bytesEqual(new Uint8Array(), new Uint8Array())).toBe(true)
        })
    })
})
