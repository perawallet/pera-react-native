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

import {
    RemoteConfigKeys,
    type RemoteConfigService,
} from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'

/** A feature `region_restrictions` can take out of a country. */
export type RegionRestrictedFeature = 'crypto_promotion' | 'swap' | 'xo_swap'

/**
 * `{"GB": ["crypto_promotion", "swap"]}`: ISO 3166-1 alpha-2 codes to the features
 * restricted there. Malformed JSON restricts nobody.
 */
export const parseRegionRestrictions = (
    json: string,
): Record<string, string[]> => {
    let parsed: unknown
    try {
        parsed = JSON.parse(json)
    } catch {
        return {}
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {}
    }
    const restrictions: Record<string, string[]> = {}
    for (const [country, features] of Object.entries(parsed)) {
        const code = country.trim().toUpperCase()
        // Skips just the bad entry, so one typo can't lift every other country.
        if (/^[A-Z]{2}$/.test(code) && Array.isArray(features)) {
            restrictions[code] = features.filter(
                (feature): feature is string => typeof feature === 'string',
            )
        }
    }
    return restrictions
}

/**
 * The features restricted in the device region, including ones only Discover
 * knows. The region is the user's setting, not their location; the backend
 * enforces by IP.
 */
export const regionRestrictedFeatures = (
    remoteConfig: RemoteConfigService,
): string[] => {
    const restrictions = parseRegionRestrictions(
        remoteConfig.getStringValue(RemoteConfigKeys.region_restrictions, '{}'),
    )
    const country = getProvider().deviceInfo.getDeviceCountry().toUpperCase()
    return restrictions[country] ?? []
}

export const isRegionRestricted = (
    remoteConfig: RemoteConfigService,
    feature: RegionRestrictedFeature,
): boolean => regionRestrictedFeatures(remoteConfig).includes(feature)
