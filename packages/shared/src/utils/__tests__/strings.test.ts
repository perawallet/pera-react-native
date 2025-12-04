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
import { encodeToBase64, decodeFromBase64 } from '../strings'
import { formatCurrency, formatDatetime, formatRelativeTime } from '../strings'

describe('utils/strings - base64 encoding', () => {
    test('encodeToBase64 encodes bytes correctly', () => {
        const bytes = new Uint8Array([80, 82, 73, 86, 75, 69, 89]) // 'PRIVKEY'
        expect(encodeToBase64(bytes)).toEqual('UFJJVktFWQ==')
    })

    test('decodeFromBase64 decodes base64 correctly', () => {
        const base64 = 'AQIDBAUG' // [1,2,3,4,5,6]
        const decoded = decodeFromBase64(base64)
        expect(Array.from(decoded)).toEqual([1, 2, 3, 4, 5, 6])
    })

    test('round-trip encode/decode returns original bytes', () => {
        const original = new Uint8Array([
            0, 1, 2, 3, 250, 251, 252, 253, 254, 255,
        ])
        const encoded = encodeToBase64(original)
        const decoded = decodeFromBase64(encoded)
        expect(Array.from(decoded)).toEqual(Array.from(original))
    })
})

describe('utils/strings - formatCurrency', () => {
    test('formats USD in en-US with precision', () => {
        expect(formatCurrency('0', 2, 'USD', 'en-US')).toBe('$0.00')
        expect(formatCurrency('1', 2, 'USD', 'en-US')).toBe('$1.00')
        expect(formatCurrency('1000', 2, 'USD', 'en-US')).toBe('$1,000.00')
        expect(formatCurrency('123456789', 2, 'USD', 'en-US')).toBe(
            '$123,456,789.00',
        )
        expect(formatCurrency('1e3', 2, 'USD', 'en-US')).toBe('$1,000.00')
    })

    test('supports precision 0 (no decimals)', () => {
        expect(formatCurrency('1', 0, 'USD', 'en-US')).toBe('$1')
        expect(formatCurrency('1000', 0, 'USD', 'en-US')).toBe('$1,000')
    })

    test('formats negative amounts', () => {
        expect(formatCurrency('-12345', 2, 'USD', 'en-US')).toBe('-$12,345.00')
    })

    test('uses locale placement/symbol for GBP in en-GB', () => {
        expect(formatCurrency('12345', 2, 'GBP', 'en-GB')).toBe('£12,345.00')
    })

    test('throws for non-integer numeric strings (BigInt constraint)', () => {
        expect(() =>
            formatCurrency('some-other-string', 2, 'USD', 'en-US'),
        ).toThrow()
    })

    describe('crypto symbol replacement (BTC, ETH, ALGO)', () => {
        test('BTC symbol (₿) with grouping and precision', () => {
            const out = formatCurrency('1234', 2, 'BTC', 'en-US')
            expect(out).toBe('₿1,234.00')
        })

        test('ETH symbol (Ξ) with custom precision', () => {
            const out = formatCurrency('1234', 4, 'ETH', 'en-US')
            expect(out).toBe('Ξ1,234.0000')
        })

        test('ALGO symbol (Ⱥ) with higher precision', () => {
            const out = formatCurrency('1234', 6, 'ALGO', 'en-US')
            expect(out).toBe('1,234.000000')
        })
    })

    test('formats with K units', () => {
        expect(formatCurrency('1000', 2, 'USD', 'en-US', true, true)).toBe(
            '$1.00K',
        )
        expect(formatCurrency('5000', 2, 'USD', 'en-US', true, true)).toBe(
            '$5.00K',
        )
        expect(formatCurrency('12345', 2, 'USD', 'en-US', true, true)).toBe(
            '$12.35K',
        )
    })

    test('formats with M units', () => {
        expect(formatCurrency('1000000', 2, 'USD', 'en-US', true, true)).toBe(
            '$1.00M',
        )
        expect(formatCurrency('5000000', 2, 'USD', 'en-US', true, true)).toBe(
            '$5.00M',
        )
        expect(formatCurrency('12345678', 2, 'USD', 'en-US', true, true)).toBe(
            '$12.35M',
        )
    })

    test('formats with B units', () => {
        expect(
            formatCurrency('1000000000', 2, 'USD', 'en-US', true, true),
        ).toBe('$1.00B')
        expect(
            formatCurrency('5000000000', 2, 'USD', 'en-US', true, true),
        ).toBe('$5.00B')
        expect(
            formatCurrency('12345678900', 2, 'USD', 'en-US', true, true),
        ).toBe('$12.35B')
    })

    test('formats with T units', () => {
        expect(
            formatCurrency('1000000000000', 2, 'USD', 'en-US', true, true),
        ).toBe('$1.00T')
        expect(
            formatCurrency('5000000000000', 2, 'USD', 'en-US', true, true),
        ).toBe('$5.00T')
        expect(
            formatCurrency('12345678900000', 2, 'USD', 'en-US', true, true),
        ).toBe('$12.35T')
    })

    test('formats without symbol when showSymbol is false', () => {
        expect(formatCurrency('1234', 2, 'USD', 'en-US', false)).toBe(
            '1,234.00',
        )
        expect(formatCurrency('5678', 2, 'GBP', 'en-GB', false)).toBe(
            '5,678.00',
        )
    })

    test('uses minPrecision to preserve trailing zeros', () => {
        expect(formatCurrency('1.5', 6, 'USD', 'en-US', true, false, 2)).toBe(
            '$1.50',
        )
        expect(formatCurrency('1.1', 6, 'USD', 'en-US', true, false, 4)).toBe(
            '$1.1000',
        )
    })

    test('truncates trailing zeros when minPrecision is set', () => {
        // When minPrecision is set, trailing zeros are truncated down to minPrecision
        expect(
            formatCurrency('1.50000', 6, 'USD', 'en-US', true, false, 0),
        ).toBe('$1.5')
        expect(
            formatCurrency('1.10000', 6, 'USD', 'en-US', true, false, 0),
        ).toBe('$1.1')
    })
})

describe('utils/strings - formatDatetime', () => {
    test('formats Date object', () => {
        const date = new Date('2023-10-05T14:30:00Z')
        const result = formatDatetime(date, 'en-US')
        expect(result).toMatch(
            /October \d{1,2}, \d{4} at \d{1,2}:\d{2} (AM|PM)/,
        )
    })

    test('formats ISO string without timezone', () => {
        const datetime = '2023-10-05T14:30:00'
        const result = formatDatetime(datetime, 'en-US')
        expect(result).toMatch(/October 5, 2023 at \d{1,2}:\d{2} (AM|PM)/)
    })

    test('formats ISO string with timezone', () => {
        const datetime = '2023-10-05T14:30:00+02:00'
        const result = formatDatetime(datetime, 'en-US')
        expect(result).toMatch(/October 5, 2023 at \d{1,2}:\d{2} (AM|PM)/)
    })
})

describe('utils/strings - formatRelativeTime', () => {
    const now = Date.now()

    test('returns "just now" for times less than 60 seconds ago', () => {
        const date = new Date(now - 30 * 1000) // 30 seconds ago
        expect(formatRelativeTime(date, now)).toBe('just now')
    })

    test('returns minutes ago for times less than 1 hour ago', () => {
        const date = new Date(now - 5 * 60 * 1000) // 5 minutes ago
        expect(formatRelativeTime(date, now)).toBe('5 minutes ago')
    })

    test('returns "1 minute ago" for exactly 1 minute ago', () => {
        const date = new Date(now - 60 * 1000) // 1 minute ago
        expect(formatRelativeTime(date, now)).toBe('1 minute ago')
    })

    test('returns hours ago for times less than 1 day ago', () => {
        const date = new Date(now - 2 * 60 * 60 * 1000) // 2 hours ago
        expect(formatRelativeTime(date, now)).toBe('2 hours ago')
    })

    test('returns "1 hour ago" for exactly 1 hour ago', () => {
        const date = new Date(now - 60 * 60 * 1000) // 1 hour ago
        expect(formatRelativeTime(date, now)).toBe('1 hour ago')
    })

    test('returns days ago for times less than 1 week ago', () => {
        const date = new Date(now - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        expect(formatRelativeTime(date, now)).toBe('3 days ago')
    })

    test('returns "yesterday" for exactly 1 day ago', () => {
        const date = new Date(now - 24 * 60 * 60 * 1000) // 1 day ago
        expect(formatRelativeTime(date, now)).toBe('yesterday')
    })

    test('returns weeks ago for times less than 1 month ago', () => {
        const date = new Date(now - 2 * 7 * 24 * 60 * 60 * 1000) // 2 weeks ago
        expect(formatRelativeTime(date, now)).toBe('2 weeks ago')
    })

    test('returns "last week" for exactly 1 week ago', () => {
        const date = new Date(now - 7 * 24 * 60 * 60 * 1000) // 1 week ago
        expect(formatRelativeTime(date, now)).toBe('last week')
    })

    test('returns months ago for times less than 1 year ago', () => {
        const date = new Date(now - 4 * 30 * 24 * 60 * 60 * 1000) // ~4 months ago
        expect(formatRelativeTime(date, now)).toBe('4 months ago')
    })

    test('returns "last month" for exactly 1 month ago', () => {
        const date = new Date(now - 30 * 24 * 60 * 60 * 1000) // ~1 month ago
        expect(formatRelativeTime(date, now)).toBe('last month')
    })

    test('returns years ago for times more than 1 year ago', () => {
        const date = new Date(now - 2 * 365 * 24 * 60 * 60 * 1000) // 2 years ago
        expect(formatRelativeTime(date, now)).toBe('2 years ago')
    })

    test('returns "last year" for exactly 1 year ago', () => {
        const date = new Date(now - 365 * 24 * 60 * 60 * 1000) // 1 year ago
        expect(formatRelativeTime(date, now)).toBe('last year')
    })

    test('handles string datetime input', () => {
        const pastTime = new Date(now - 10 * 60 * 1000).toISOString() // 10 minutes ago
        expect(formatRelativeTime(pastTime, now)).toBe('10 minutes ago')
    })

    test('handles string datetime with timezone', () => {
        const pastTime = new Date(now - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
        expect(formatRelativeTime(pastTime, now)).toBe('2 hours ago')
    })
})
