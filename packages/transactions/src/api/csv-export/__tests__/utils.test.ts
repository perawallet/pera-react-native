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

import { describe, it, expect } from 'vitest'
import {
    isValidISODate,
    formatISODate,
    generateFilename,
    buildCsvQueryParams,
    countCsvRows,
} from '../utils'

describe('CSV Export Utils', () => {
    describe('isValidISODate', () => {
        it('returns true for valid ISO dates', () => {
            expect(isValidISODate('2024-01-15')).toBe(true)
            expect(isValidISODate('2024-12-31')).toBe(true)
            expect(isValidISODate('2023-02-28')).toBe(true)
        })

        it('returns false for invalid formats', () => {
            expect(isValidISODate('2024-1-15')).toBe(false)
            expect(isValidISODate('01-15-2024')).toBe(false)
            expect(isValidISODate('2024/01/15')).toBe(false)
            expect(isValidISODate('invalid')).toBe(false)
        })

        it('returns false for invalid dates', () => {
            expect(isValidISODate('2024-02-30')).toBe(false)
            expect(isValidISODate('2024-13-01')).toBe(false)
            expect(isValidISODate('2024-00-15')).toBe(false)
        })
    })

    describe('formatISODate', () => {
        it('formats dates correctly', () => {
            expect(formatISODate(new Date(2024, 0, 15))).toBe('2024-01-15')
            expect(formatISODate(new Date(2024, 11, 31))).toBe('2024-12-31')
            expect(formatISODate(new Date(2024, 5, 5))).toBe('2024-06-05')
        })
    })

    describe('generateFilename', () => {
        it('generates default filename with address', () => {
            const address = 'ABC123DEF456'
            expect(generateFilename(address)).toBe('ABC123DEF456.csv')
        })

        it('uses custom filename when provided', () => {
            expect(generateFilename('ABC', 'my-export')).toBe('my-export.csv')
            expect(generateFilename('ABC', 'my-export.csv')).toBe(
                'my-export.csv',
            )
        })
    })

    describe('buildCsvQueryParams', () => {
        it('returns empty object when no date range', () => {
            expect(buildCsvQueryParams()).toEqual({})
            expect(buildCsvQueryParams({})).toEqual({})
        })

        it('includes start_date when provided', () => {
            expect(buildCsvQueryParams({ startDate: '2024-01-01' })).toEqual({
                start_date: '2024-01-01',
            })
        })

        it('includes end_date when provided', () => {
            expect(buildCsvQueryParams({ endDate: '2024-12-31' })).toEqual({
                end_date: '2024-12-31',
            })
        })

        it('includes both dates when provided', () => {
            expect(
                buildCsvQueryParams({
                    startDate: '2024-01-01',
                    endDate: '2024-12-31',
                }),
            ).toEqual({
                start_date: '2024-01-01',
                end_date: '2024-12-31',
            })
        })

        it('throws error for invalid start date', () => {
            expect(() =>
                buildCsvQueryParams({ startDate: 'invalid' }),
            ).toThrow()
        })

        it('throws error for invalid end date', () => {
            expect(() => buildCsvQueryParams({ endDate: 'invalid' })).toThrow()
        })
    })

    describe('countCsvRows', () => {
        it('returns 0 for empty content', () => {
            expect(countCsvRows('')).toBe(0)
        })

        it('returns 0 for header only', () => {
            expect(countCsvRows('Date,Type,Amount')).toBe(0)
        })

        it('counts data rows correctly', () => {
            const csv = `Date,Type,Amount
2024-01-15,pay,1000
2024-01-16,axfer,500`
            expect(countCsvRows(csv)).toBe(2)
        })

        it('handles CRLF line endings', () => {
            const csv = 'Date,Type,Amount\r\n2024-01-15,pay,1000\r\n'
            expect(countCsvRows(csv)).toBe(1)
        })
    })
})
