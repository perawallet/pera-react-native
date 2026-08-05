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

import { BASE_LOCALE, TRANSLATION_BUNDLES } from './locales'

const parseActiveLocales = (raw: string): Set<string> =>
    new Set(
        raw
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean),
    )

/**
 * The locale set the app may actually resolve to or offer right now: client
 * translation bundles intersected with the backend's `active_locales`
 * allowlist, gated by `enable_language_selection`. Shipping a bundle
 * (client-ready) and marking a locale active on the backend (server-ready)
 * are independent — this is where both have to agree before a locale
 * becomes reachable. `en` is always included: a misconfigured or empty
 * allowlist must never leave the app with zero valid locales.
 *
 * `bundledLocales` defaults to the real registry but is overridable so
 * tests can exercise the intersection against a richer set than what's
 * actually shipped. Safe to default, unlike `resolveLocale`'s required
 * `supportedLocales`: this function *is* the gate, so omitting the argument
 * can't bypass one.
 */
export const getEffectiveSupportedLocales = (
    isLanguageSelectionEnabled: boolean,
    activeLocalesRaw: string,
    bundledLocales: readonly string[] = Object.keys(TRANSLATION_BUNDLES),
): ReadonlySet<string> => {
    if (!isLanguageSelectionEnabled) {
        return new Set([BASE_LOCALE])
    }

    const active = parseActiveLocales(activeLocalesRaw)
    const effective = new Set(
        bundledLocales.filter(locale => active.has(locale)),
    )
    effective.add(BASE_LOCALE)
    return effective
}
