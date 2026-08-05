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

void i18n.use(initReactI18next).init({
    resources,
    lng: BASE_LOCALE,
    fallbackLng: BASE_LOCALE,
    interpolation: {
        escapeValue: false, // react already safes from xss
    },
})
