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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import { encodeToBase64, decodeFromBase64, toUrlSafeBase64 } from '../strings'
import { hexToBytes, bytesToHex, utf8ByteLength } from '../strings'
import {
    decodeLongString,
    formatCurrency,
    formatDatetime,
    formatPercentage,
    formatRelativeTime,
    formatRawNumberInput,
    getInitials,
    formatTime,
} from '../strings'
import { logger } from '../logging'

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

describe('utils/strings - toUrlSafeBase64', () => {
    test('maps +/ to -_ and strips padding', () => {
        expect(toUrlSafeBase64('ab+/cd==')).toBe('ab-_cd')
    })

    test('leaves an already url-safe string unchanged', () => {
        expect(toUrlSafeBase64('abcd')).toBe('abcd')
    })

    test('strips only trailing padding, preserving inner =', () => {
        expect(toUrlSafeBase64('a=b=')).toBe('a=b')
    })

    test('handles empty and all-padding inputs', () => {
        expect(toUrlSafeBase64('')).toBe('')
        expect(toUrlSafeBase64('==')).toBe('')
    })

    test('produces valid base64url from encoded bytes', () => {
        // 0xfb 0xff → '+/8=' in standard base64; url-safe form is '-_8'.
        expect(toUrlSafeBase64(encodeToBase64(new Uint8Array([251, 255])))).toBe(
            '-_8',
        )
    })
})

describe('utils/strings - hex encoding', () => {
    test('hexToBytes converts hex string to Uint8Array', () => {
        expect(Array.from(hexToBytes('00ff10'))).toEqual([0, 255, 16])
    })

    test('bytesToHex converts Uint8Array to hex string', () => {
        expect(bytesToHex(new Uint8Array([0, 255, 16]))).toBe('00ff10')
    })

    test('round-trip hex encode/decode returns original bytes', () => {
        const original = new Uint8Array([0, 1, 127, 128, 254, 255])
        const hex = bytesToHex(original)
        const decoded = hexToBytes(hex)
        expect(Array.from(decoded)).toEqual(Array.from(original))
    })

    test('hexToBytes handles empty string', () => {
        expect(Array.from(hexToBytes(''))).toEqual([])
    })

    test('bytesToHex handles empty array', () => {
        expect(bytesToHex(new Uint8Array([]))).toBe('')
    })
})

describe('utils/strings - formatCurrency', () => {
    test('formats USD in en-US with precision', () => {
        expect(formatCurrency('0', 2, 'USD', 'en-US')).toBe('$ 0.00')
        expect(formatCurrency('1', 2, 'USD', 'en-US')).toBe('$ 1.00')
        expect(formatCurrency('1000', 2, 'USD', 'en-US')).toBe('$ 1,000.00')
        expect(formatCurrency('123456789', 2, 'USD', 'en-US')).toBe(
            '$ 123,456,789.00',
        )
        expect(formatCurrency('1e3', 2, 'USD', 'en-US')).toBe('$ 1,000.00')
    })

    test('supports precision 0 (no decimals)', () => {
        expect(formatCurrency('1', 0, 'USD', 'en-US')).toBe('$ 1')
        expect(formatCurrency('1000', 0, 'USD', 'en-US')).toBe('$ 1,000')
    })

    test('formats negative amounts', () => {
        expect(formatCurrency('-12345', 2, 'USD', 'en-US')).toBe('-$ 12,345.00')
    })

    test('uses locale placement/symbol for GBP in en-GB', () => {
        expect(formatCurrency('12345', 2, 'GBP', 'en-GB')).toBe('£ 12,345.00')
    })

    test('throws for non-integer numeric strings (BigInt constraint)', () => {
        expect(() =>
            formatCurrency('some-other-string', 2, 'USD', 'en-US'),
        ).toThrow()
    })

    describe('crypto currency formatting (BTC, ETH, ALGO)', () => {
        test('BTC uses currency code with grouping and precision', () => {
            const out = formatCurrency('1234', 2, 'BTC', 'en-US')
            expect(out).toBe('BTC 1,234.00')
        })

        test('ETH uses currency code with custom precision', () => {
            const out = formatCurrency('1234', 4, 'ETH', 'en-US')
            expect(out).toBe('ETH 1,234.0000')
        })

        test('ALGO shows no symbol with higher precision', () => {
            const out = formatCurrency('1234', 6, 'ALGO', 'en-US')
            expect(out).toBe('1,234.000000')
        })
    })

    test('formats with K units', () => {
        expect(formatCurrency('1000', 2, 'USD', 'en-US', true, true)).toBe(
            '$ 1.00K',
        )
        expect(formatCurrency('5000', 2, 'USD', 'en-US', true, true)).toBe(
            '$ 5.00K',
        )
        expect(formatCurrency('12345', 2, 'USD', 'en-US', true, true)).toBe(
            '$ 12.35K',
        )
    })

    test('formats with M units', () => {
        expect(formatCurrency('1000000', 2, 'USD', 'en-US', true, true)).toBe(
            '$ 1.00M',
        )
        expect(formatCurrency('5000000', 2, 'USD', 'en-US', true, true)).toBe(
            '$ 5.00M',
        )
        expect(formatCurrency('12345678', 2, 'USD', 'en-US', true, true)).toBe(
            '$ 12.35M',
        )
    })

    test('formats with B units', () => {
        expect(
            formatCurrency('1000000000', 2, 'USD', 'en-US', true, true),
        ).toBe('$ 1.00B')
        expect(
            formatCurrency('5000000000', 2, 'USD', 'en-US', true, true),
        ).toBe('$ 5.00B')
        expect(
            formatCurrency('12345678900', 2, 'USD', 'en-US', true, true),
        ).toBe('$ 12.35B')
    })

    test('formats with T units', () => {
        expect(
            formatCurrency('1000000000000', 2, 'USD', 'en-US', true, true),
        ).toBe('$ 1.00T')
        expect(
            formatCurrency('5000000000000', 2, 'USD', 'en-US', true, true),
        ).toBe('$ 5.00T')
        expect(
            formatCurrency('12345678900000', 2, 'USD', 'en-US', true, true),
        ).toBe('$ 12.35T')
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
            '$ 1.50',
        )
        expect(formatCurrency('1.1', 6, 'USD', 'en-US', true, false, 4)).toBe(
            '$ 1.1000',
        )
    })

    test('truncates trailing zeros when minPrecision is set', () => {
        // When minPrecision is set, trailing zeros are truncated down to minPrecision
        expect(
            formatCurrency('1.50000', 6, 'USD', 'en-US', true, false, 0),
        ).toBe('$ 1.5')
        expect(
            formatCurrency('1.10000', 6, 'USD', 'en-US', true, false, 0),
        ).toBe('$ 1.1')
    })
})

describe('utf8ByteLength', () => {
    test('counts ASCII as one byte each', () => {
        expect(utf8ByteLength('hello')).toBe(5)
    })

    test('counts multi-byte characters by their UTF-8 size, not code units', () => {
        // '€' is 3 UTF-8 bytes but length 1; '😀' is 4 bytes, length 2.
        expect(utf8ByteLength('€')).toBe(3)
        expect(utf8ByteLength('😀')).toBe(4)
        expect('😀'.length).toBe(2)
    })

    test('empty string is zero', () => {
        expect(utf8ByteLength('')).toBe(0)
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

    test('returns an empty string when datetime is undefined', () => {
        expect(formatDatetime(undefined)).toBe('')
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

describe('utils/strings - formatRawNumberInput', () => {
    test('applies thousands separators to the integer portion', () => {
        expect(formatRawNumberInput('1234567', 'en-US')).toBe('1,234,567')
    })

    test('preserves the fractional portion with a locale decimal separator', () => {
        expect(formatRawNumberInput('1234.56', 'en-US')).toBe('1,234.56')
    })

    test('treats an empty integer part as zero', () => {
        expect(formatRawNumberInput('.5', 'en-US')).toBe('0.5')
    })
})

describe('utils/strings - getInitials', () => {
    test('returns the first letter of the first N words', () => {
        expect(getInitials('John Ronald Tolkien', 2)).toBe('JR')
    })

    test('returns a single letter when there is only one word', () => {
        expect(getInitials('Madonna', 2)).toBe('M')
    })

    test('uppercases non-ASCII initials', () => {
        expect(getInitials('élodie')).toBe('É')
    })

    test('returns ? when there are no usable words', () => {
        expect(getInitials('   ')).toBe('?')
    })
})

describe('utils/strings - formatTime', () => {
    test('formats seconds as MM:SS when under an hour', () => {
        expect(formatTime(125)).toBe('02:05')
    })

    test('formats with HH:MM:SS once an hour or more has elapsed', () => {
        expect(formatTime(3661)).toBe('01:01:01')
    })
})

describe('utils/strings - formatPercentage', () => {
    test('formats with two decimals and a trailing percent sign by default', () => {
        expect(formatPercentage(new Decimal('12.345'))).toBe('12.35%')
    })

    test('preserves the sign for negative values', () => {
        expect(formatPercentage(new Decimal('-7.5'))).toBe('-7.50%')
    })

    test('accepts a custom precision', () => {
        expect(formatPercentage(new Decimal('12.345'), 1)).toBe('12.3%')
    })

    test('accepts a plain number', () => {
        expect(formatPercentage(50)).toBe('50.00%')
    })
})

describe('utils/strings - decodeLongString', () => {
    beforeEach(() => {
        vi.spyOn(logger, 'warn').mockImplementation(() => {})
        vi.mocked(logger.warn).mockClear()
    })

    test('returns null for null and undefined', () => {
        expect(decodeLongString(null)).toBeNull()
        expect(decodeLongString(undefined)).toBeNull()
    })

    test('returns null for non-string non-number inputs', () => {
        expect(decodeLongString(true)).toBeNull()
        expect(decodeLongString({})).toBeNull()
        expect(decodeLongString([])).toBeNull()
    })

    test('returns null for empty string', () => {
        expect(decodeLongString('')).toBeNull()
    })

    test('passes finite numbers through unchanged', () => {
        expect(decodeLongString(42)).toBe(42)
        expect(decodeLongString(0)).toBe(0)
        expect(decodeLongString(-1.5)).toBe(-1.5)
    })

    test('returns null for non-finite numbers', () => {
        expect(decodeLongString(Number.NaN)).toBeNull()
        expect(decodeLongString(Number.POSITIVE_INFINITY)).toBeNull()
        expect(decodeLongString(Number.NEGATIVE_INFINITY)).toBeNull()
    })

    test('parses string-encoded integers', () => {
        expect(decodeLongString('123')).toBe(123)
        expect(decodeLongString('0')).toBe(0)
        expect(decodeLongString('-999')).toBe(-999)
    })

    test('returns null for non-numeric strings', () => {
        expect(decodeLongString('not-a-number')).toBeNull()
        expect(decodeLongString('12abc')).toBeNull()
    })

    test('warns with the supplied field name when input exceeds MAX_SAFE_INTEGER', () => {
        decodeLongString('9999999999999999', 'lastSeenNotificationId')
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining(
                'lastSeenNotificationId: value "9999999999999999" exceeds Number.MAX_SAFE_INTEGER',
            ),
        )
    })

    test('uses "decodeLongString" as the label when fieldName is omitted', () => {
        decodeLongString('9999999999999999')
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('decodeLongString: value'),
        )
    })

    test('does not warn for safe-integer string values', () => {
        decodeLongString('123', 'someField')
        expect(logger.warn).not.toHaveBeenCalled()
    })
})
