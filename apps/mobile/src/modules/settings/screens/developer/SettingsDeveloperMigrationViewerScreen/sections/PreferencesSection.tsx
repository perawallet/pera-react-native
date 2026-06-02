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

import { useLanguage } from '@hooks/useLanguage'
import type { LegacyPreferences } from '@perawallet/wallet-extension-platform'
import {
    CollapsibleSection,
    ComparisonRow,
    InlineRow,
} from '../SettingsDeveloperMigrationViewerScreen'
import type { RNMigrationSnapshot } from '../useRNMigrationSnapshot'

const PREFERENCE_KEYS: Array<keyof LegacyPreferences> = [
    'theme',
    'currency',
    'termsAcceptedVersion',
    'biometricEnabled',
    'rekeySupport',
    'privacyMode',
    'arc59ExpressSendWarningEnabled',
    'applicationOpenCount',
    'lockAttemptCount',
    'lockPenaltyRemainingMs',
    'appAtBackgroundMs',
    'notificationRefreshTimestampMs',
    'copyAddressCount',
    'assetFilterZeroBalance',
    'assetFilterDisplayNFT',
    'assetFilterDisplayOptedInNFT',
    'collectibleFilterNotOwned',
    'nftFilterDisplayWatchAccountNFTs',
    'nftListingViewType',
    'accountSortPreference',
    'assetSortPreference',
    'collectibleSortPreference',
    'swapLastUsedAddress',
    'swapUseLocalCurrency',
    'swapSlippageTolerance',
    'swapTermsAccepted',
]

export const PreferencesSection = ({
    preferences,
    rn,
}: {
    preferences: LegacyPreferences
    rn: RNMigrationSnapshot
}) => {
    const { t } = useLanguage()
    return (
        <CollapsibleSection
            title={t('settings.developer.migration_viewer.section_preferences')}
            count={PREFERENCE_KEYS.length}
        >
            {PREFERENCE_KEYS.map(key => {
                const cmp = preferenceComparison(key, preferences, rn)
                if (cmp === null) {
                    return (
                        <InlineRow
                            key={key}
                            label={key}
                            value={preferences[key]}
                        />
                    )
                }
                return (
                    <ComparisonRow
                        key={key}
                        label={key}
                        legacyValue={cmp.legacy}
                        rnValue={cmp.rn}
                        matches={cmp.matches}
                    />
                )
            })}
        </CollapsibleSection>
    )
}

const preferenceComparison = (
    key: keyof LegacyPreferences,
    p: LegacyPreferences,
    rn: RNMigrationSnapshot,
): { legacy: unknown; rn: unknown; matches?: boolean } | null => {
    switch (key) {
        case 'theme':
            return matchEq(p.theme, rn.preferences.theme)
        case 'currency':
            return matchEq(p.currency, rn.preferences.currency)
        case 'privacyMode':
            return matchEq(p.privacyMode ?? false, rn.preferences.privacyMode)
        case 'assetFilterZeroBalance':
            return matchEq(
                p.assetFilterZeroBalance ?? false,
                rn.preferences.assetFilterZeroBalance,
            )
        case 'assetFilterDisplayNFT':
            return matchEq(
                p.assetFilterDisplayNFT ?? false,
                rn.preferences.assetFilterDisplayNFT,
            )
        case 'assetFilterDisplayOptedInNFT':
            return matchEq(
                p.assetFilterDisplayOptedInNFT ?? false,
                rn.preferences.assetFilterDisplayOptedInNFT,
            )
        case 'collectibleFilterNotOwned':
            return matchEq(
                p.collectibleFilterNotOwned ?? true,
                rn.preferences.collectibleFilterNotOwned,
            )
        case 'nftFilterDisplayWatchAccountNFTs':
            return matchEq(
                p.nftFilterDisplayWatchAccountNFTs ?? true,
                rn.preferences.nftFilterDisplayWatchAccountNFTs,
            )
        case 'nftListingViewType':
            return matchEq(
                p.nftListingViewType,
                rn.preferences.nftListingViewType,
            )
        case 'swapSlippageTolerance':
            return {
                legacy: p.swapSlippageTolerance,
                rn: rn.preferences.swapSlippageTolerance,
                matches:
                    p.swapSlippageTolerance ===
                    rn.preferences.swapSlippageTolerance,
            }
        case 'swapTermsAccepted':
            return matchEq(
                p.swapTermsAccepted ?? false,
                rn.preferences.swapTermsAccepted,
            )
        case 'accountSortPreference':
            return {
                legacy: p.accountSortPreference,
                rn: rn.preferences.accountSortPreference,
            }
        case 'assetSortPreference':
            return {
                legacy: p.assetSortPreference,
                rn: rn.preferences.assetSortPreference,
            }
        case 'collectibleSortPreference':
            return {
                legacy: p.collectibleSortPreference,
                rn: rn.preferences.collectibleSortPreference,
            }
        default:
            return null
    }
}

const matchEq = <T,>(legacy: T, rn: T) => ({
    legacy,
    rn,
    matches: legacy === rn,
})
