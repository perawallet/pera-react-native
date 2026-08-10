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
import { getEffectiveSupportedLocales } from '../effectiveLocales'

// Exercises a hypothetical richer bundle set (design doc §4.1's wave-one
// list) even though only `en` ships today — bundledLocales is a parameter
// for exactly this reason, mirroring resolveLocale's supportedLocales param.
const BUNDLED = ['en', 'es', 'de', 'fr']

describe('i18n/effectiveLocales - getEffectiveSupportedLocales', () => {
    it('returns only en when language selection is disabled, regardless of active_locales', () => {
        expect(
            getEffectiveSupportedLocales(false, 'es,de,fr', BUNDLED),
        ).toEqual(new Set(['en']))
    })

    it('returns only en when enabled but active_locales is empty', () => {
        expect(getEffectiveSupportedLocales(true, '', BUNDLED)).toEqual(
            new Set(['en']),
        )
    })

    it('intersects bundled locales with active_locales when enabled', () => {
        expect(getEffectiveSupportedLocales(true, 'de,fr', BUNDLED)).toEqual(
            new Set(['en', 'de', 'fr']),
        )
    })

    it('ignores an active locale that has no bundle', () => {
        expect(getEffectiveSupportedLocales(true, 'de,tr', BUNDLED)).toEqual(
            new Set(['en', 'de']),
        )
    })

    it('trims whitespace around each tag in the CSV list', () => {
        expect(
            getEffectiveSupportedLocales(true, ' de , fr ', BUNDLED),
        ).toEqual(new Set(['en', 'de', 'fr']))
    })

    it('always includes en even if the allowlist omits it', () => {
        expect(getEffectiveSupportedLocales(true, 'de', BUNDLED)).toContain(
            'en',
        )
    })

    it('defaults bundledLocales to the real, bundle-derived registry', () => {
        // `ja` is deliberately not a wave-one locale, so it stays unshipped
        // and keeps proving the allowlist can't conjure a bundle. Naming a
        // locale that *is* planned (this asserted on `fr` before) means the
        // test quietly stops testing anything the day that bundle lands.
        expect(
            getEffectiveSupportedLocales(true, 'de,es,fr,tr,pt-BR,ja'),
        ).toEqual(new Set(['en', 'de', 'es', 'fr', 'tr', 'pt-BR']))
    })
})
