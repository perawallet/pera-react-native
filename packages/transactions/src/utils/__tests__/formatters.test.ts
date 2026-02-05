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
import {
    formatMicroAlgos,
    parseRoundTime,
    formatAssetAmount,
    getDateRangeParams,
} from '../formatters'

describe('formatMicroAlgos', () => {
    test('converts microAlgos to ALGOs', () => {
        expect(formatMicroAlgos('1000000')).toBe('1.000000')
    })

    test('handles fractional amounts', () => {
        expect(formatMicroAlgos('1500000')).toBe('1.500000')
    })

    test('respects custom decimal places', () => {
        expect(formatMicroAlgos('1500000', 2)).toBe('1.50')
    })

    test('handles large amounts', () => {
        expect(formatMicroAlgos('1000000000000')).toBe('1000000.000000')
    })

    test('handles zero', () => {
        expect(formatMicroAlgos('0')).toBe('0.000000')
    })
})

describe('parseRoundTime', () => {
    test('converts Unix seconds to Date', () => {
        const timestamp = 1704067200 // 2024-01-01 00:00:00 UTC
        const date = parseRoundTime(timestamp)
        expect(date.getTime()).toBe(1704067200000)
    })

    test('returns correct year', () => {
        const timestamp = 1704067200
        const date = parseRoundTime(timestamp)
        expect(date.getUTCFullYear()).toBe(2024)
    })
})

describe('formatAssetAmount', () => {
    test('formats with asset decimals', () => {
        expect(formatAssetAmount('1000000', 6)).toBe('1.000000')
    })

    test('formats with zero decimals', () => {
        expect(formatAssetAmount('1000', 0)).toBe('1000')
    })

    test('formats with custom display decimals', () => {
        expect(formatAssetAmount('1000000', 6, 2)).toBe('1.00')
    })

    test('handles large amounts with many decimals', () => {
        expect(formatAssetAmount('1000000000000000000', 18, 4)).toBe('1.0000')
    })
})

describe('getDateRangeParams', () => {
    test('returns afterTime and beforeTime', () => {
        const params = getDateRangeParams(30)
        expect(params).toHaveProperty('afterTime')
        expect(params).toHaveProperty('beforeTime')
    })

    test('afterTime is before beforeTime', () => {
        const params = getDateRangeParams(30)
        expect(new Date(params.afterTime).getTime()).toBeLessThan(
            new Date(params.beforeTime).getTime(),
        )
    })

    test('returns ISO formatted strings', () => {
        const params = getDateRangeParams(7)
        expect(params.afterTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        expect(params.beforeTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
})
