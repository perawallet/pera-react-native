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
import { DEFAULT_PAGE_SIZE, DEFAULT_PRECISION } from '../constants'

describe('constants', () => {
    test('DEFAULT_PAGE_SIZE is 50', () => {
        expect(DEFAULT_PAGE_SIZE).toBe(50)
    })

    test('DEFAULT_PAGE_SIZE is a positive number', () => {
        expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0)
        expect(typeof DEFAULT_PAGE_SIZE).toBe('number')
    })

    test('DEFAULT_PRECISION is 2', () => {
        expect(DEFAULT_PRECISION).toBe(2)
    })

    test('DEFAULT_PRECISION is a non-negative number', () => {
        expect(DEFAULT_PRECISION).toBeGreaterThanOrEqual(0)
        expect(typeof DEFAULT_PRECISION).toBe('number')
    })
})
