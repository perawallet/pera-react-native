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

import { SUPPORTED_LOCALES } from '../../i18n/locales'
import type { AnyParsedDeeplink, DevLocaleTourDeeplink } from './types'
import { normalizeUrl, parseQueryParams } from './utils'

// `perawallet` is the only scheme this app actually registers (see
// app.config.builder.js) — `pera://` is not an OS-level URL scheme, so a
// `pera://...` deeplink would never reach this parser via `xcrun simctl
// openurl` / OS Linking. Reusing the registered scheme, under a `dev/` path
// namespace, is what makes this URL actually deliverable.
const DEV_LOCALE_TOUR_URL_BASE = 'perawallet://app/dev/locale-tour'

/**
 * Parses `perawallet://app/dev/locale-tour?locale=<tag>&step=<id>` (one
 * step) or `?locale=<tag>&run=all` (the whole tour — see runTour.ts).
 *
 * A `locale` that isn't in `SUPPORTED_LOCALES` (i18n/locales.ts — the single
 * source both this file and i18n/index.ts read from), or a URL with neither
 * `step` nor `run=all`, is unrecognized input, not a partially-parsed
 * deeplink — mirrors the asset-id boundary check in new-parser.ts.
 */
export const parseDevLocaleTourUri = (
    url: string,
): Nullable<DevLocaleTourDeeplink> => {
    const normalizedUrl = normalizeUrl(url)
    const [withoutQuery] = normalizedUrl.split('?')
    if (withoutQuery.replace(/\/$/, '') !== DEV_LOCALE_TOUR_URL_BASE) {
        return null
    }

    const params = parseQueryParams(url)
    if (!params.locale || !SUPPORTED_LOCALES.has(params.locale)) return null

    if (params.run === 'all') {
        return {
            type: 'DEV_LOCALE_TOUR',
            sourceUrl: url,
            locale: params.locale,
            run: 'all',
        }
    }

    if (!params.step) return null

    return {
        type: 'DEV_LOCALE_TOUR',
        sourceUrl: url,
        locale: params.locale,
        step: params.step,
    }
}

/**
 * Narrows a parsed deeplink to the tour's own type. Lives here, beside the
 * only code that produces that tag, so `useDeepLink.ts` can dispatch the tour
 * without naming the tag itself — a mention there would survive into the
 * release bundles this module is swapped out of.
 */
export const isDevLocaleTourDeeplink = (
    parsed: AnyParsedDeeplink,
): parsed is DevLocaleTourDeeplink => parsed.type === 'DEV_LOCALE_TOUR'
