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

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { logger, setActiveLocale } from '@perawallet/wallet-core-shared'
import { BASE_LOCALE, TRANSLATION_BUNDLES } from './locales'
import { getPseudoResources } from './pseudoResources'
import 'intl-pluralrules'

const resources = {
    ...Object.fromEntries(
        Object.entries(TRANSLATION_BUNDLES).map(([locale, bundle]) => [
            locale,
            { translation: bundle },
        ]),
    ),
    ...getPseudoResources(),
}

// Always starts on BASE_LOCALE, never a device-matched guess: Remote Config
// — which gates every locale beyond `en`, see effectiveLocales.ts — hasn't
// fetched yet at this import instant, so there is no way to know here
// whether anything beyond `en` is actually allowed. useAppBootstrap
// re-resolves for every user, not just ones with a saved override, once
// Remote Config and the settings store are both ready, behind the splash
// gate — see its syncLanguagePreference.
setActiveLocale(BASE_LOCALE)

// Keeps wallet-core-shared's number/date formatting locale in sync with
// every subsequent change (useAppBootstrap's resolution, or a future
// language-picker selection) — not just this initial value.
i18n.on('languageChanged', setActiveLocale)

void i18n.use(initReactI18next).init({
    resources,
    lng: BASE_LOCALE,
    fallbackLng: BASE_LOCALE,
    interpolation: {
        escapeValue: false, // react already safes from xss
    },
    // Surfaces dynamically-built keys (e.g. t(`errors.algod.${code}.title`))
    // that static lint can't see (tools/i18n-lint.cjs). __DEV__-only:
    // production must not pay for the bookkeeping or warn on users' devices.
    saveMissing: __DEV__,
    missingKeyHandler: __DEV__
        ? (_languages, namespace, key) => {
              logger.warn(`[i18n] missing key: ${namespace}:${key}`)
          }
        : undefined,
})

export default i18n
