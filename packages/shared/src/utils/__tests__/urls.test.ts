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
import { stripUrlScheme, buildPrismUrl } from '../urls'

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

describe('utils/urls - buildPrismUrl', () => {
    test('appends width and default quality to URL without query params', () => {
        expect(buildPrismUrl('https://cdn.example.com/logo.png', 40)).toBe(
            'https://cdn.example.com/logo.png?width=40&quality=70',
        )
    })

    test('appends with & when URL already has query params', () => {
        expect(buildPrismUrl('https://cdn.example.com/logo.png?v=2', 80)).toBe(
            'https://cdn.example.com/logo.png?v=2&width=80&quality=70',
        )
    })

    test('uses custom quality when provided', () => {
        expect(buildPrismUrl('https://cdn.example.com/logo.png', 100, 90)).toBe(
            'https://cdn.example.com/logo.png?width=100&quality=90',
        )
    })

    test('rounds fractional width values', () => {
        expect(buildPrismUrl('https://cdn.example.com/logo.png', 40.7)).toBe(
            'https://cdn.example.com/logo.png?width=41&quality=70',
        )
    })

    test('returns undefined for null input', () => {
        expect(buildPrismUrl(null, 40)).toBeUndefined()
    })

    test('returns undefined for undefined input', () => {
        expect(buildPrismUrl(undefined, 40)).toBeUndefined()
    })

    test('returns undefined for empty string', () => {
        expect(buildPrismUrl('', 40)).toBeUndefined()
    })
})
