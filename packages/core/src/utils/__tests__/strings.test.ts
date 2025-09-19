import { describe, test, expect } from 'vitest'
import { truncateAlgorandAddress } from '../addresses'
import { asFixedPrecisionNumber } from '../strings'

describe('utils/addresses - truncateAlgorandAddress', () => {
    test('returns original when length <= 11', () => {
        expect(truncateAlgorandAddress('SHORT')).toEqual('SHORT')
        expect(truncateAlgorandAddress('ABCDEFGHIJK')).toEqual('ABCDEFGHIJK')
    })

    test('truncates when length > 11 (5+...+5)', () => {
        expect(truncateAlgorandAddress('ABCDEFGHIJKL')).toEqual('ABCDE...HIJKL')
        expect(truncateAlgorandAddress('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toEqual(
            'ABCDE...VWXYZ',
        )
    })
})

describe('utils/strings - asFixedPrecisionNumber', () => {
    test('returns original value if multiple dots present', () => {
        expect(asFixedPrecisionNumber('1.2.3', 2)).toEqual('1.2.3')
        expect(asFixedPrecisionNumber('..', 2)).toEqual('..')
    })

    test('handles zero precision by returning integer part only', () => {
        expect(asFixedPrecisionNumber('123', 0)).toEqual('123')
        expect(asFixedPrecisionNumber('123.45', 0)).toEqual('123')
        expect(asFixedPrecisionNumber('.45', 0)).toEqual('0')
        expect(asFixedPrecisionNumber('', 0)).toEqual('0')
    })

    test('pads with zeros when no fractional part', () => {
        expect(asFixedPrecisionNumber('5', 2)).toEqual('5.00')
        expect(asFixedPrecisionNumber('0', 3)).toEqual('0.000')
    })

    test('ensures leading zero when input starts with dot', () => {
        expect(asFixedPrecisionNumber('.5', 2)).toEqual('0.50')
        expect(asFixedPrecisionNumber('.', 2)).toEqual('0.00')
    })

    test('keeps fractional part if shorter than precision (pads to precision)', () => {
        expect(asFixedPrecisionNumber('1.2', 3)).toEqual('1.200')
        expect(asFixedPrecisionNumber('1.', 2)).toEqual('1.00')
    })

    test('keeps fractional part if exactly matches precision', () => {
        expect(asFixedPrecisionNumber('1.23', 2)).toEqual('1.23')
        expect(asFixedPrecisionNumber('0.000', 3)).toEqual('0.000')
    })

    test('rounds correctly when fractional part exceeds precision', () => {
        // 1.234 -> 1.23 (third digit is 4, so no round up)
        expect(asFixedPrecisionNumber('1.234', 2)).toEqual('1.23')
        // 1.235 -> 1.24 (third digit is 5, round half up)
        expect(asFixedPrecisionNumber('1.235', 2)).toEqual('1.24')
        // 0.999 -> 1.00 (carry into integer part)
        expect(asFixedPrecisionNumber('0.999', 2)).toEqual('1.00')
    })

    test('rounds correctly when fractional part exceeds precision with big numbers', () => {
        // 1.234 -> 1.23 (third digit is 4, so no round up)
        expect(asFixedPrecisionNumber('19437587588.2323423454', 9)).toEqual('19437587588.232342345')
        // 1.235 -> 1.24 (third digit is 5, round half up)
        expect(asFixedPrecisionNumber('19437587588.2323423455', 9)).toEqual('19437587588.232342346')
        // 0.999 -> 1.00 (carry into integer part)
        expect(asFixedPrecisionNumber('19437587588.9999990001', 5)).toEqual('19437587589.00000')
    })

    test('handles leading + sign and pads to precision', () => {
        expect(asFixedPrecisionNumber('+123.4', 2)).toEqual('+123.40')
    })

    test('returns original for invalid fractional digits (non-digit after dot)', () => {
        expect(asFixedPrecisionNumber('123.e4', 2)).toEqual('123.e4')
    })

    test('returns original for invalid integer digits (non-digit before dot)', () => {
        expect(asFixedPrecisionNumber('1a3.45', 2)).toEqual('1a3.45')
    })

    test('rounds half-up to integer (precision=0) with carry', () => {
        expect(asFixedPrecisionNumber('9.5', 0)).toEqual('10')
    })

    test('rounds with fractional overflow carry into integer', () => {
        expect(asFixedPrecisionNumber('1.995', 2)).toEqual('2.00')
    })

    test('handles negative sign and zero-padding', () => {
        expect(asFixedPrecisionNumber('-07.8', 2)).toEqual('-07.80')
    })

    test('rounds half-up negative to integer', () => {
        expect(asFixedPrecisionNumber('-123.5', 0)).toEqual('-124')
    })

    test('extracts leading + sign and pads to requested precision', () => {
        expect(asFixedPrecisionNumber('+123.4', 2)).toEqual('+123.40')
    })

    test('returns original for invalid digit groups (non-digits present)', () => {
        expect(asFixedPrecisionNumber('123.e4', 2)).toEqual('123.e4')
        expect(asFixedPrecisionNumber('1a3.45', 2)).toEqual('1a3.45')
    })

    test('rounds half-up to integer (precision=0) with carry', () => {
        expect(asFixedPrecisionNumber('9.5', 0)).toEqual('10')
    })

    test('handles empty input and negative precision', () => {
        expect(asFixedPrecisionNumber('', -1)).toEqual('0')
        expect(asFixedPrecisionNumber('-', -1)).toEqual('0')
        expect(asFixedPrecisionNumber('+', -1)).toEqual('0')
        expect(asFixedPrecisionNumber('', 1)).toEqual('0.0')
        expect(asFixedPrecisionNumber('-', 1)).toEqual('0.0')
        expect(asFixedPrecisionNumber('+', 1)).toEqual('0.0')
    })
})
