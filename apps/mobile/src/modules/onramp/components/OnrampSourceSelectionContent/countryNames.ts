/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// ISO 3166-1 alpha-2 → display name for the fiat source rows. We keep a small
// local map (rather than relying on Hermes' optional Intl.DisplayNames) for the
// fiat currencies the ramp providers surface. Unknown codes fall back to the
// token name at the call site.
const COUNTRY_NAMES: Record<string, string> = {
    AU: 'Australia',
    BR: 'Brazil',
    CA: 'Canada',
    CH: 'Switzerland',
    CN: 'China',
    DE: 'Germany',
    DK: 'Denmark',
    ES: 'Spain',
    EU: 'European Union',
    FR: 'France',
    GB: 'United Kingdom',
    HK: 'Hong Kong',
    IN: 'India',
    JP: 'Japan',
    KR: 'South Korea',
    MX: 'Mexico',
    NG: 'Nigeria',
    NO: 'Norway',
    NZ: 'New Zealand',
    PL: 'Poland',
    SE: 'Sweden',
    SG: 'Singapore',
    TR: 'Turkey',
    US: 'United States',
    ZA: 'South Africa',
}

export const countryNameFromCode = (code: string): string | null =>
    COUNTRY_NAMES[code.toUpperCase()] ?? null
