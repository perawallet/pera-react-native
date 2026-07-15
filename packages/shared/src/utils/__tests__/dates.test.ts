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

import { describe, it, expect } from 'vitest'
import {
    isValidISODate,
    formatISODate,
    formatDisplayDate,
    parseRoundTime,
    toISODateString,
    getDateRangeParams,
    formatTimeRemaining,
    isoDateToUnixSeconds,
} from '../dates'

describe('isValidISODate', () => {
    it('returns true for valid ISO dates', () => {
        expect(isValidISODate('2024-01-01')).toBe(true)
        expect(isValidISODate('2024-12-31')).toBe(true)
        expect(isValidISODate('2024-02-29')).toBe(true) // leap year
    })

    it('returns false for invalid format', () => {
        expect(isValidISODate('01-01-2024')).toBe(false) // wrong order
        expect(isValidISODate('2024/01/01')).toBe(false) // wrong separator
        expect(isValidISODate('2024-1-1')).toBe(false) // missing leading zeros
        expect(isValidISODate('24-01-01')).toBe(false) // 2-digit year
    })

    it('returns false for invalid dates', () => {
        expect(isValidISODate('2024-02-30')).toBe(false) // Feb 30 doesn't exist
        expect(isValidISODate('2023-02-29')).toBe(false) // not a leap year
        expect(isValidISODate('2024-13-01')).toBe(false) // month 13
        expect(isValidISODate('2024-00-01')).toBe(false) // month 0
    })
})

describe('formatISODate', () => {
    it('formats dates correctly', () => {
        expect(formatISODate(new Date(2024, 0, 1))).toBe('2024-01-01')
        expect(formatISODate(new Date(2024, 11, 31))).toBe('2024-12-31')
        expect(formatISODate(new Date(2024, 5, 15))).toBe('2024-06-15')
    })

    it('pads single-digit months and days', () => {
        expect(formatISODate(new Date(2024, 0, 5))).toBe('2024-01-05')
        expect(formatISODate(new Date(2024, 8, 9))).toBe('2024-09-09')
    })
})

describe('formatDisplayDate', () => {
    it('formats ISO date to human-readable format', () => {
        expect(formatDisplayDate('2025-11-06')).toBe('Nov 6, 2025')
        expect(formatDisplayDate('2024-01-01')).toBe('Jan 1, 2024')
        expect(formatDisplayDate('2024-12-31')).toBe('Dec 31, 2024')
    })
})

describe('parseRoundTime', () => {
    it('converts Unix seconds to Date', () => {
        const timestamp = 1704067200 // 2024-01-01 00:00:00 UTC
        const date = parseRoundTime(timestamp)
        expect(date.getTime()).toBe(1704067200000)
    })

    it('returns correct year', () => {
        const timestamp = 1704067200
        const date = parseRoundTime(timestamp)
        expect(date.getUTCFullYear()).toBe(2024)
    })
})

describe('toISODateString', () => {
    it('returns ISO string', () => {
        const date = new Date('2024-01-01T00:00:00.000Z')
        expect(toISODateString(date)).toBe('2024-01-01T00:00:00.000Z')
    })
})

describe('getDateRangeParams', () => {
    it('returns afterTime and beforeTime', () => {
        const params = getDateRangeParams(30)
        expect(params).toHaveProperty('afterTime')
        expect(params).toHaveProperty('beforeTime')
    })

    it('afterTime is before beforeTime', () => {
        const params = getDateRangeParams(30)
        expect(new Date(params.afterTime).getTime()).toBeLessThan(
            new Date(params.beforeTime).getTime(),
        )
    })

    it('returns ISO formatted strings', () => {
        const params = getDateRangeParams(7)
        expect(params.afterTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        expect(params.beforeTime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
})

describe('formatTimeRemaining', () => {
    const now = new Date('2026-05-06T10:00:00Z').getTime()

    it('returns null when the expiry has passed', () => {
        expect(
            formatTimeRemaining(new Date('2026-05-06T09:59:59Z'), now),
        ).toBeNull()
        expect(
            formatTimeRemaining(new Date('2026-05-06T10:00:00Z'), now),
        ).toBeNull()
    })

    it('returns "<1m" when less than one minute remains', () => {
        expect(formatTimeRemaining(new Date('2026-05-06T10:00:30Z'), now)).toBe(
            '<1m',
        )
    })

    it('formats minutes when less than an hour remains', () => {
        expect(formatTimeRemaining(new Date('2026-05-06T10:52:00Z'), now)).toBe(
            '52m',
        )
    })

    it('formats hours when less than a day remains', () => {
        expect(formatTimeRemaining(new Date('2026-05-06T13:00:00Z'), now)).toBe(
            '3h',
        )
    })

    it('formats days when more than a day remains', () => {
        expect(formatTimeRemaining(new Date('2026-05-09T10:00:00Z'), now)).toBe(
            '3d',
        )
    })
})

describe('isoDateToUnixSeconds', () => {
    it('converts a YYYY-MM-DD date to UTC start-of-day unix seconds', () => {
        expect(isoDateToUnixSeconds('2024-01-02')).toBe(
            Date.UTC(2024, 0, 2) / 1000,
        )
    })

    it('returns NaN for undefined, empty, or unparseable input', () => {
        expect(isoDateToUnixSeconds(undefined)).toBeNaN()
        expect(isoDateToUnixSeconds('')).toBeNaN()
        expect(isoDateToUnixSeconds('not-a-date')).toBeNaN()
    })
})
