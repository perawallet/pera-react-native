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

import type { AnyParsedDeeplink } from '@perawallet/wallet-core-deeplinks'

import type { E2eStressContactCount } from './e2e-fixture-names'

/**
 * The locale tour's discriminant, declared as a type with deliberately no
 * runtime member anywhere. Only the tour's own parser produces it and only the
 * tour's own handler reads it, and metro.config.js swaps both for stubs
 * outside dev builds — a runtime constant would keep the tag string alive
 * in release bundles after every module that could act on it is gone.
 */
export type DevLocaleTourDeeplinkType = 'DEV_LOCALE_TOUR'

/** Same no-runtime-member rule as the locale tour, for the E2E fixture hook. */
export type DevE2eFixtureDeeplinkType = 'DEV_E2E_FIXTURE'

/**
 * `perawallet://app/dev/locale-tour?locale=<tag>&step=<id>` drives one
 * screenshot-tour step; `?locale=<tag>&run=all` drives every step in the
 * default tour scope behind a single deeplink (see runTour.ts — one OS
 * confirmation dialog instead of 190). Exactly one of `step`/`run` is
 * present; the parser rejects a URL with neither. Dev-only; see
 * DevLocaleTourDeeplinkType above. Reuses the already-registered `perawallet`
 * scheme (`pera://` is not registered as an OS URL scheme in
 * app.config.builder.js).
 */
export interface DevLocaleTourDeeplink {
    type: DevLocaleTourDeeplinkType
    sourceUrl: string
    locale: string
    step?: string
    run?: 'all'
}

export type E2eFixtureName =
    | 'home'
    | 'contacts-empty'
    | 'contacts-one'
    | `contacts-${E2eStressContactCount}`

/**
 * `perawallet://app/dev/e2e-fixture?name=<fixture>` puts the app into a named
 * state for a device test. Only names, never data: the URL cannot carry
 * contacts, addresses or key material. Ships only in a bundle built with
 * E2E_FIXTURES=1 (see metro-build-gates.js).
 */
export interface DevE2eFixtureDeeplink {
    type: DevE2eFixtureDeeplinkType
    sourceUrl: string
    fixture: E2eFixtureName
}

export type AppDeeplink =
    | AnyParsedDeeplink
    | DevLocaleTourDeeplink
    | DevE2eFixtureDeeplink
