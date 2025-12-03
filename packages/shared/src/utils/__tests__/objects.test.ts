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
import { stripNulls } from '../objects'

describe('utils/objects', () => {
    describe('stripNulls', () => {
        test('removes null values from object', () => {
            const obj = { a: 1, b: null, c: 3 }
            const result = stripNulls(obj)
            expect(result).toEqual({ a: 1, c: 3 })
        })

        test('removes undefined values from object', () => {
            const obj = { a: 1, b: undefined, c: 3 }
            const result = stripNulls(obj)
            expect(result).toEqual({ a: 1, c: 3 })
        })

        test('keeps falsy values that are not null or undefined', () => {
            const obj = { a: 0, b: false, c: '', d: null }
            const result = stripNulls(obj)
            expect(result).toEqual({ a: 0, b: false, c: '' })
        })

        test('handles empty object', () => {
            const obj = {}
            const result = stripNulls(obj)
            expect(result).toEqual({})
        })

        test('handles object with all null values', () => {
            const obj = { a: null, b: null, c: null }
            const result = stripNulls(obj)
            expect(result).toEqual({})
        })
    })
})
