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
    WEBVIEW_FALLBACK_LANGUAGE,
    resolveWebviewLanguage,
    withLanguageParam,
} from '../webviewLanguage'

describe('resolveWebviewLanguage', () => {
    it('passes through every locale the app can actually resolve to', () => {
        // The wave-one set, i.e. the keys of TRANSLATION_BUNDLES. `pt-BR` is
        // the one that carries a region, so it also covers the "already
        // region-qualified, do not touch it" case.
        for (const locale of ['en', 'de', 'es', 'fr', 'tr', 'pt-BR']) {
            expect(resolveWebviewLanguage(locale)).toBe(locale)
        }
    })

    it('passes through the dev pseudolocale rather than masking it', () => {
        // If a tester is running en-XA, Discover reporting en-US would hide
        // exactly the mismatch they are looking for.
        expect(resolveWebviewLanguage('en-XA')).toBe('en-XA')
    })

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['empty string', ''],
        ['whitespace only', '   '],
    ])('falls back to en-US when the locale is %s', (_label, input) => {
        expect(resolveWebviewLanguage(input)).toBe(WEBVIEW_FALLBACK_LANGUAGE)
        expect(resolveWebviewLanguage(input)).toBe('en-US')
    })

    it('trims surrounding whitespace instead of forwarding a padded tag', () => {
        expect(resolveWebviewLanguage('  fr  ')).toBe('fr')
    })
})

describe('withLanguageParam', () => {
    it('starts a query string when the url has none', () => {
        expect(withLanguageParam('https://perawallet.app/terms/', 'de')).toBe(
            'https://perawallet.app/terms/?lang=de',
        )
    })

    it('appends to an existing query string', () => {
        expect(withLanguageParam('https://perawallet.app/x?a=1', 'fr')).toBe(
            'https://perawallet.app/x?a=1&lang=fr',
        )
    })

    it('falls back to en-US when the locale is empty', () => {
        expect(withLanguageParam('https://perawallet.app/x', '')).toBe(
            'https://perawallet.app/x?lang=en-US',
        )
    })

    it('keeps a region-qualified tag intact', () => {
        expect(withLanguageParam('https://perawallet.app/x', 'pt-BR')).toBe(
            'https://perawallet.app/x?lang=pt-BR',
        )
    })
})
