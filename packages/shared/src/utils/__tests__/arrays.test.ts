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
import { partition } from '../arrays'

describe('utils/arrays', () => {
    describe('partition', () => {
        test('partitions array into chunks of specified size', () => {
            const array = [1, 2, 3, 4, 5, 6, 7, 8, 9]
            const result = partition(array, 3)
            expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
        })

        test('handles array not evenly divisible by chunk size', () => {
            const array = [1, 2, 3, 4, 5, 6, 7]
            const result = partition(array, 3)
            expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]])
        })

        test('handles empty array', () => {
            const array: number[] = []
            const result = partition(array, 3)
            expect(result).toEqual([])
        })

        test('handles chunk size larger than array', () => {
            const array = [1, 2, 3]
            const result = partition(array, 10)
            expect(result).toEqual([[1, 2, 3]])
        })

        test('handles chunk size of 1', () => {
            const array = [1, 2, 3]
            const result = partition(array, 1)
            expect(result).toEqual([[1], [2], [3]])
        })
    })
})
