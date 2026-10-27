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

import type { Nullable } from '@perawallet/wallet-core-shared'

import {
    normalizeUrl,
    parseQueryParams,
} from '@perawallet/wallet-core-deeplinks'

import { E2E_STRESS_CONTACT_COUNTS } from './e2e-fixture-names'
import type {
    AppDeeplink,
    DevE2eFixtureDeeplink,
    E2eFixtureName,
} from './types'

const DEV_E2E_FIXTURE_URL_BASE = 'perawallet://app/dev/e2e-fixture'

const FIXTURE_NAMES: ReadonlySet<string> = new Set<E2eFixtureName>([
    'home',
    'contacts-empty',
    'contacts-one',
    ...E2E_STRESS_CONTACT_COUNTS.map(
        (count): E2eFixtureName => `contacts-${count}`,
    ),
])

/** Parses `perawallet://app/dev/e2e-fixture?name=<fixture>`; an unknown name is unrecognized input. */
export const parseDevE2eFixtureUri = (
    url: string,
): Nullable<DevE2eFixtureDeeplink> => {
    const [withoutQuery] = normalizeUrl(url).split('?')
    if (withoutQuery.replace(/\/$/, '') !== DEV_E2E_FIXTURE_URL_BASE) {
        return null
    }

    const { name } = parseQueryParams(url)
    if (!name || !FIXTURE_NAMES.has(name)) return null

    return {
        type: 'DEV_E2E_FIXTURE',
        sourceUrl: url,
        fixture: name as E2eFixtureName,
    }
}

// Lives beside the only producer of the tag, for the reason given in
// dev-locale-tour-parser.ts.
export const isDevE2eFixtureDeeplink = (
    parsed: AppDeeplink,
): parsed is DevE2eFixtureDeeplink => parsed.type === 'DEV_E2E_FIXTURE'
