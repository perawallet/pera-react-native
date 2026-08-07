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

import { describe, expect, it } from 'vitest'
import { parseStakingProjectsI18nConfig } from '../parseStakingProjectsI18nConfig'

const project = (id: string, description: string) => ({
    id,
    title: 'Folks Finance',
    description,
    logoUrl: 'https://example.com/logo.png',
    link: 'https://app.folks.finance',
    type: 'liquid' as const,
})

const CONFIG = {
    en: [project('folks', 'Stake your Algo on Folks')],
    de: [project('folks', 'Stake dein Algo auf Folks')],
    'pt-BR': [project('folks', 'Faça staking dos seus Algo na Folks')],
}

const raw = JSON.stringify(CONFIG)

describe('parseStakingProjectsI18nConfig', () => {
    it('returns an empty array when raw is empty or whitespace', () => {
        expect(parseStakingProjectsI18nConfig('', 'en')).toEqual([])
        expect(parseStakingProjectsI18nConfig('   \n\t', 'en')).toEqual([])
    })

    it('selects the exact locale when present', () => {
        expect(parseStakingProjectsI18nConfig(raw, 'de')[0].description).toBe(
            'Stake dein Algo auf Folks',
        )
        expect(
            parseStakingProjectsI18nConfig(raw, 'pt-BR')[0].description,
        ).toBe('Faça staking dos seus Algo na Folks')
    })

    it('falls back to en for a locale with no entry', () => {
        expect(parseStakingProjectsI18nConfig(raw, 'tr')[0].description).toBe(
            'Stake your Algo on Folks',
        )
    })

    it('resolves a region-qualified request to its base language', () => {
        // de-AT has no entry of its own; `de` does.
        expect(
            parseStakingProjectsI18nConfig(raw, 'de-AT')[0].description,
        ).toBe('Stake dein Algo auf Folks')
    })

    it('resolves the dev pseudolocale to en rather than an empty screen', () => {
        // en-XA is what the locale tour runs under. Returning [] here would
        // make the Staking screen look broken during a translation sweep.
        expect(
            parseStakingProjectsI18nConfig(raw, 'en-XA')[0].description,
        ).toBe('Stake your Algo on Folks')
    })

    it('resolves an unqualified request to a region-qualified entry', () => {
        // Only `pt-BR` is published; a device asking for bare `pt` should get
        // it rather than falling through to English.
        const ptOnly = JSON.stringify({
            en: CONFIG.en,
            'pt-BR': CONFIG['pt-BR'],
        })
        expect(
            parseStakingProjectsI18nConfig(ptOnly, 'pt')[0].description,
        ).toBe('Faça staking dos seus Algo na Folks')
    })

    it('throws on malformed JSON', () => {
        expect(() => parseStakingProjectsI18nConfig('not-json', 'en')).toThrow(
            'Invalid staking projects remote config JSON',
        )
    })

    it('throws when the payload has no en locale to fall back to', () => {
        const noEn = JSON.stringify({ de: CONFIG.de })
        // zod serializes the refine message into a JSON array, so the inner
        // quotes around the locale arrive escaped — match the plain prose.
        expect(() => parseStakingProjectsI18nConfig(noEn, 'de')).toThrow(
            /must include a/,
        )
    })

    it('throws when a locale array fails project validation', () => {
        const badType = JSON.stringify({
            en: [{ ...project('folks', 'desc'), type: 'not-a-type' }],
        })
        expect(() => parseStakingProjectsI18nConfig(badType, 'en')).toThrow()
    })

    it('throws on duplicate ids within a locale', () => {
        const dupes = JSON.stringify({
            en: [project('folks', 'one'), project('folks', 'two')],
        })
        expect(() => parseStakingProjectsI18nConfig(dupes, 'en')).toThrow()
    })

    it('is still an array of full project objects, not just descriptions', () => {
        const [first] = parseStakingProjectsI18nConfig(raw, 'de')
        expect(first).toMatchObject({
            id: 'folks',
            title: 'Folks Finance',
            logoUrl: 'https://example.com/logo.png',
            link: 'https://app.folks.finance',
            type: 'liquid',
        })
    })
})
