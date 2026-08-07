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

import { getActiveLocale } from '@perawallet/wallet-core-shared'
import type { StakingProjectInfo } from '../models'
import {
    STAKING_FALLBACK_LOCALE,
    stakingProjectsI18nConfigSchema,
} from '../models/schema'
import type { StakingProjectsI18nConfig } from '../models/schema'

/**
 * Picks the best available locale from a `staking_projects_i18n` payload.
 *
 * Exact tag first, then the base language, then `en`. The base-language step is
 * what makes `en-XA` (the dev pseudolocale) resolve to `en` content rather than
 * an empty screen, and lets the backend publish a single `pt` entry that serves
 * `pt-BR` — or a `pt-BR` entry that an unqualified `pt` device still finds.
 */
const resolveLocaleKey = (
    byLocale: StakingProjectsI18nConfig,
    locale: string,
): string => {
    if (Object.hasOwn(byLocale, locale)) {
        return locale
    }

    const base = locale.split('-')[0]
    if (base !== locale && Object.hasOwn(byLocale, base)) {
        return base
    }

    // A region-qualified entry serving an unqualified request: `pt` → `pt-BR`.
    const regionalMatch = Object.keys(byLocale).find(
        key => key.split('-')[0] === base,
    )

    return regionalMatch ?? STAKING_FALLBACK_LOCALE
}

/**
 * Parse Firebase Remote Config key `staking_projects_i18n` — a map of locale tag
 * to the project array the legacy `staking_projects` key held — and return the
 * entry for the app's active language.
 *
 * Returns an empty array when the value is absent, matching
 * `parseStakingProjectsConfig`: Firebase may not have fetched yet, or the key
 * may be unset in this environment, and the Staking screen should render empty
 * rather than error. Throws on malformed JSON or a schema violation; the hook
 * layer catches those and surfaces them as its error state.
 *
 * The schema requires an `en` entry, so the fallback can always be satisfied.
 */
export const parseStakingProjectsI18nConfig = (
    raw: string,
    locale: string = getActiveLocale(),
): StakingProjectInfo[] => {
    if (!raw || !raw.trim()) {
        return []
    }

    let parsedValue: unknown

    try {
        parsedValue = JSON.parse(raw)
    } catch {
        throw new Error('Invalid staking projects i18n remote config JSON')
    }

    const byLocale = stakingProjectsI18nConfigSchema.parse(parsedValue)

    return byLocale[resolveLocaleKey(byLocale, locale)]
}
