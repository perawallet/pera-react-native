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
import { resolveLocale } from '../locales'

// Exercises the full wave-one matrix (design doc §4.1) even though only `en`
// has a real bundle today — resolveLocale takes the supported set as a
// parameter for exactly this reason.
const SIX_LOCALES = new Set(['en', 'es', 'de', 'fr', 'tr', 'pt-BR'])

describe('i18n/locales - resolveLocale', () => {
    it('returns the override when it is a supported locale', () => {
        expect(resolveLocale('de', ['en-US'], SIX_LOCALES)).toBe('de')
    })

    it('ignores an unsupported override and falls back to device resolution', () => {
        expect(resolveLocale('xx', ['de-AT'], SIX_LOCALES)).toBe('de')
    })

    it('matches an exact device tag', () => {
        expect(resolveLocale('system', ['pt-BR'], SIX_LOCALES)).toBe('pt-BR')
    })

    it('matches on base language when the exact tag is unsupported', () => {
        expect(resolveLocale('system', ['de-AT'], SIX_LOCALES)).toBe('de')
    })

    it('aliases pt to pt-BR, since we ship pt-BR and not bare pt', () => {
        expect(resolveLocale('system', ['pt-PT'], SIX_LOCALES)).toBe('pt-BR')
        expect(resolveLocale('system', ['pt'], SIX_LOCALES)).toBe('pt-BR')
    })

    it('walks the device list in order, skipping unsupported tags', () => {
        expect(resolveLocale('system', ['ja-JP', 'fr-CA'], SIX_LOCALES)).toBe(
            'fr',
        )
    })

    it('falls back to en when no device tag matches', () => {
        expect(resolveLocale('system', ['ja-JP', 'ko-KR'], SIX_LOCALES)).toBe(
            'en',
        )
    })

    it('falls back to en with an empty device locale list', () => {
        expect(resolveLocale('system', [], SIX_LOCALES)).toBe('en')
    })
})
