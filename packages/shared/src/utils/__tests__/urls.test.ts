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
