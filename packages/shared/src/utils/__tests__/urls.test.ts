import { describe, test, expect } from 'vitest'
import { stripUrlScheme } from '../urls'

describe('utils/urls - stripUrlScheme', () => {
    test('strips https:// prefix', () => {
        expect(stripUrlScheme('https://example.com')).toBe('example.com')
    })

    test('strips http:// prefix', () => {
        expect(stripUrlScheme('http://example.com')).toBe('example.com')
    })

    test('strips wss:// prefix', () => {
        expect(stripUrlScheme('wss://example.com')).toBe('example.com')
    })

    test('preserves path after domain', () => {
        expect(stripUrlScheme('https://example.com/path/to/page')).toBe(
            'example.com/path/to/page',
        )
    })

    test('strips protocol-relative // prefix', () => {
        expect(stripUrlScheme('//example.com')).toBe('example.com')
    })

    test('returns url unchanged when no // present', () => {
        expect(stripUrlScheme('example.com')).toBe('example.com')
    })

    test('returns undefined when given undefined', () => {
        expect(stripUrlScheme(undefined)).toBeUndefined()
    })

    test('returns empty string when given empty string', () => {
        expect(stripUrlScheme('')).toBe('')
    })
})
