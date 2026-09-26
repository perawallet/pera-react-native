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

import type { SupportedCountry } from '@perawallet/wallet-core-card'

/**
 * Maps an ISO 3166-1 alpha-2 code (e.g. "DE") to its display name (e.g.
 * "Germany") using the Baanx-supported country list. Returns `undefined` when
 * the code is missing or not in the list, so callers can fall back to the code.
 */
export const getCountryName = (
    code: string | undefined,
    countries: SupportedCountry[],
): string | undefined =>
    code
        ? countries.find(country => country.iso3166alpha2 === code)?.name
        : undefined
