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

import { describe, expect, it, vi } from 'vitest'
import { TRANSLATION_BUNDLES } from '@i18n/locales'
import { EMBEDDED_TERMS, getEmbeddedTerms } from '../embeddedTerms'

// A translation that drops or merges a clause changes these counts, which is
// the cheapest signal that a locale went stale after the English copy changed.
const STRUCTURAL_TAGS = ['<p ', '<li ', '<ul>', '<strong>', '<a ']

const english = EMBEDDED_TERMS.en
const styleBlock = (html: string) => html.match(/<style>[\s\S]*?<\/style>/)?.[0]
const htmlLang = (html: string) => html.match(/<html lang="([^"]+)">/)?.[1]
const locales = Object.keys(TRANSLATION_BUNDLES)

describe('embedded terms sync guard', () => {
    it('ships a bundled copy for every translated locale', () => {
        expect(Object.keys(EMBEDDED_TERMS).sort()).toEqual([...locales].sort())
    })

    it('pins the bundled version to the remote-config default', async () => {
        // The shared platform mock stubs RemoteConfigDefaults; the guard needs
        // the real default the app ships with.
        const { RemoteConfigDefaults } = await vi.importActual<
            typeof import('@perawallet/wallet-extension-platform')
        >('@perawallet/wallet-extension-platform')

        expect(english.version).toBe(RemoteConfigDefaults.terms_version)
    })

    it.each(locales)('%s matches the English copy structurally', locale => {
        const terms = EMBEDDED_TERMS[locale]

        expect(terms.version).toBe(english.version)
        expect(htmlLang(terms.html)).toBe(locale)
        expect(styleBlock(terms.html)).toBe(styleBlock(english.html))
        for (const tag of STRUCTURAL_TAGS) {
            expect(terms.html.split(tag).length, tag).toBe(
                english.html.split(tag).length,
            )
        }
    })

    it.each([
        ['en-XA', 'en'],
        ['', 'en'],
        [undefined, 'en'],
        ['xx', 'en'],
        ['pt-BR', 'pt-BR'],
    ])('resolves %s to the %s copy', (input, expected) => {
        expect(getEmbeddedTerms(input)).toBe(EMBEDDED_TERMS[expected])
    })
})
