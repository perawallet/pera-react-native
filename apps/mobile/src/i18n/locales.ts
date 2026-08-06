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

import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'

/**
 * Every locale this app has an actual translation bundle for. Add a real
 * locale here (plus its JSON import) — this is the single place both
 * i18n/index.ts (building i18next's resources) and the locale-tour deeplink
 * parser (validating `locale=`) read from. Adding a locale only in
 * index.ts's resources map, without adding it here too, is exactly the
 * mistake this file exists to make impossible: the deeplink would keep
 * silently rejecting that locale as unrecognized.
 *
 * Side-effect free on purpose (a JSON import has none): non-i18n code can
 * consult `SUPPORTED_LOCALES` without pulling in i18next initialization.
 */
export const TRANSLATION_BUNDLES: Readonly<
    Record<string, Record<string, unknown>>
> = {
    en,
    de,
    es,
}

export const BASE_LOCALE = 'en'

/**
 * The tag only, deliberately not alongside the transform that generates its
 * bundle (pseudolocale.ts): this module is in every build, and importing the
 * generator to read one string would drag the accent tables back in with it.
 */
export const PSEUDO_LOCALE = 'en-XA'

/**
 * Locale tags this app can resolve, including the dev-only pseudolocale.
 * Listing the pseudolocale here unconditionally is harmless — it's just a
 * string tag; whether it's actually *registered as an i18next resource*
 * depends on which module pseudoResources.ts resolves to.
 */
export const SUPPORTED_LOCALES: ReadonlySet<string> = new Set([
    ...Object.keys(TRANSLATION_BUNDLES),
    PSEUDO_LOCALE,
])

/**
 * Locales whose base language resolves to a different supported tag than
 * itself. Today only Portuguese: we ship `pt-BR`, not bare `pt`, so a device
 * reporting `pt-PT` (base `pt`) needs redirecting there rather than falling
 * through to `en`.
 */
const LOCALE_ALIASES: Readonly<Record<string, string>> = {
    pt: 'pt-BR',
}

const baseLanguage = (tag: string): string => tag.split('-')[0].toLowerCase()

/**
 * Picks the locale i18next should activate: an explicit user override first
 * (validated against `supportedLocales`, since a stored preference could
 * predate a locale being dropped), then the device's ordered locale list —
 * exact tag, then base-language match, then the `pt` alias — falling back to
 * `BASE_LOCALE`.
 *
 * `supportedLocales` is required on purpose. The only correct set to pass is
 * `getEffectiveSupportedLocales(...)` — the Remote-Config-gated one. Defaulting
 * it to the raw `SUPPORTED_LOCALES` registry would let a new call site silently
 * bypass every gate just by omitting the argument.
 */
export const resolveLocale = (
    override: string,
    deviceLocales: readonly string[],
    supportedLocales: ReadonlySet<string>,
): string => {
    if (override !== 'system' && supportedLocales.has(override)) {
        return override
    }

    for (const tag of deviceLocales) {
        if (supportedLocales.has(tag)) return tag

        const base = baseLanguage(tag)
        if (supportedLocales.has(base)) return base

        const aliased = LOCALE_ALIASES[base]
        if (aliased && supportedLocales.has(aliased)) return aliased
    }

    return BASE_LOCALE
}
