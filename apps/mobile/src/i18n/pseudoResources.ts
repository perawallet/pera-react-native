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

import type { PseudoResources } from '@modules/locale-tour/types'

import { BASE_LOCALE, PSEUDO_LOCALE, TRANSLATION_BUNDLES } from './locales'
import { buildPseudoBundle } from './pseudolocale'

/**
 * The pseudolocale's i18next `resources` entry, generated at call time rather
 * than committed: it's mechanically derived from `en`, and ~180 KB of
 * generated strings has no business in a bundle that can't reach it.
 */
export const getPseudoResources = (): PseudoResources => ({
    [PSEUDO_LOCALE]: {
        translation: buildPseudoBundle(TRANSLATION_BUNDLES[BASE_LOCALE]),
    },
})
