import { describe, test, expect } from 'vitest'
import { encodeToBase64, decodeFromBase64 } from '../strings'
import { formatCurrency } from '../strings'

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
        expect(formatCurrency('1000', 2, 'USD', 'en-US', true, 'K')).toBe(
            '$1.00',
        )
        expect(formatCurrency('5000', 2, 'USD', 'en-US', true, 'K')).toBe(
            '$5.00',
        )
        expect(formatCurrency('12345', 2, 'USD', 'en-US', true, 'K')).toBe(
            '$12.35',
        )
    })

    test('formats with M units', () => {
        expect(formatCurrency('1000000', 2, 'USD', 'en-US', true, 'M')).toBe(
            '$1.00',
        )
        expect(formatCurrency('5000000', 2, 'USD', 'en-US', true, 'M')).toBe(
            '$5.00',
        )
        expect(formatCurrency('12345678', 2, 'USD', 'en-US', true, 'M')).toBe(
            '$12.35',
        )
    })

    test('formats without symbol when showSymbol is false', () => {
        expect(formatCurrency('1234', 2, 'USD', 'en-US', false)).toBe(
            '1,234.00',
        )
        expect(formatCurrency('5678', 2, 'GBP', 'en-GB', false)).toBe(
            '5,678.00',
        )
    })
})
