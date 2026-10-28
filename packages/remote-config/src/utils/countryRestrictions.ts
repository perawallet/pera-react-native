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

import type { RemoteConfigService } from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'

/** A JSON array of ISO 3166-1 alpha-2 codes; a malformed value restricts nobody. */
export const parseRestrictedCountries = (json: string): string[] => {
    try {
        const countries: unknown = JSON.parse(json)
        if (
            Array.isArray(countries) &&
            countries.every(
                country =>
                    typeof country === 'string' &&
                    /^[a-z]{2}$/i.test(country.trim()),
            )
        ) {
            return countries.map(country => country.trim().toUpperCase())
        }
    } catch {
        // Falls through to no restriction.
    }
    return []
}

/**
 * Whether the device region is on the country list under `key`. The region is
 * the user's setting, not their location; the backend enforces by IP.
 */
export const isDeviceCountryRestricted = (
    remoteConfig: RemoteConfigService,
    key: string,
): boolean => {
    const countries = parseRestrictedCountries(
        remoteConfig.getStringValue(key, '[]'),
    )
    // Usually empty, and the capability layers read this on every check.
    return (
        countries.length > 0 &&
        countries.includes(
            getProvider().deviceInfo.getDeviceCountry().toUpperCase(),
        )
    )
}
