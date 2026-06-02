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

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    useAssetPreferencesStore,
    useCollectiblePreferencesStore,
} from '@perawallet/wallet-core-assets'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { useSettingsStore } from '@perawallet/wallet-core-settings'
import type { LegacyPreferences } from '@perawallet/wallet-extension-platform'

const SECURITY_PIN_SETUP_PROMPT_KEY = 'security_pin_setup_prompt'

export const migratePreferences = (preferences: LegacyPreferences): void => {
    applyAppearance(preferences)
    applyCurrency(preferences)
    applyAssetFilters(preferences)
    applyCollectiblePreferences(preferences)
    applyAccountSort(preferences)
    applyPromptDismissals(preferences)
    applyMiscFlags(preferences)
}

const applyAppearance = (preferences: LegacyPreferences): void => {
    const settings = useSettingsStore.getState()
    if (preferences.theme !== null) settings.setTheme(preferences.theme)
    if (preferences.privacyMode !== null) {
        settings.setPrivacyMode(preferences.privacyMode)
    }
}

const applyCurrency = (preferences: LegacyPreferences): void => {
    if (!preferences.currency) return
    useCurrenciesStore.getState().setPreferredCurrency(preferences.currency)
}

const applyAssetFilters = (preferences: LegacyPreferences): void => {
    const store = useAssetPreferencesStore.getState()
    if (preferences.assetFilterZeroBalance !== null) {
        store.setHideZeroBalance(preferences.assetFilterZeroBalance)
    }
    if (preferences.assetFilterDisplayNFT !== null) {
        store.setDisplayNfts(preferences.assetFilterDisplayNFT)
    }
    if (preferences.assetFilterDisplayOptedInNFT !== null) {
        store.setDisplayOptedInNfts(preferences.assetFilterDisplayOptedInNFT)
    }
    if (preferences.assetSortPreference !== null) {
        store.setAssetSortMode(preferences.assetSortPreference)
    }
}

const applyCollectiblePreferences = (preferences: LegacyPreferences): void => {
    const store = useCollectiblePreferencesStore.getState()
    if (preferences.collectibleFilterNotOwned !== null) {
        store.setShowOptedIn(!preferences.collectibleFilterNotOwned)
    }
    if (preferences.nftFilterDisplayWatchAccountNFTs !== null) {
        store.setShowWatchAccounts(preferences.nftFilterDisplayWatchAccountNFTs)
    }
    if (preferences.nftListingViewType !== null) {
        store.setGalleryLayout(preferences.nftListingViewType)
    }
    if (preferences.collectibleSortPreference !== null) {
        store.setCollectibleSortMode(preferences.collectibleSortPreference)
    }
}

const applyAccountSort = (preferences: LegacyPreferences): void => {
    if (preferences.accountSortPreference !== null) {
        useAccountsStore
            .getState()
            .setSortMode(preferences.accountSortPreference)
    }
}

const applyPromptDismissals = (preferences: LegacyPreferences): void => {
    if (preferences.pinSetupPromptDismissed === true) {
        useSettingsStore
            .getState()
            .setPreference(SECURITY_PIN_SETUP_PROMPT_KEY, true)
    }
}

const LEGACY_NAMESPACE = 'legacy.'

type Persistable = string | number | boolean

const isPersistable = (value: unknown): value is Persistable => {
    const t = typeof value
    return t === 'string' || t === 'number' || t === 'boolean'
}

const applyMiscFlags = (preferences: LegacyPreferences): void => {
    const settings = useSettingsStore.getState()

    const writeIfPresent = (
        key: string,
        value: Persistable | null | undefined,
    ): void => {
        if (value == null) return
        settings.setPreference(`${LEGACY_NAMESPACE}${key}`, value)
    }

    writeIfPresent('termsAcceptedVersion', preferences.termsAcceptedVersion)
    writeIfPresent('biometricEnabled', preferences.biometricEnabled)
    writeIfPresent('rekeySupport', preferences.rekeySupport)
    writeIfPresent(
        'arc59ExpressSendWarningEnabled',
        preferences.arc59ExpressSendWarningEnabled,
    )
    writeIfPresent('applicationOpenCount', preferences.applicationOpenCount)
    writeIfPresent('appAtBackgroundMs', preferences.appAtBackgroundMs)
    writeIfPresent(
        'notificationRefreshTimestampMs',
        preferences.notificationRefreshTimestampMs,
    )
    writeIfPresent('copyAddressCount', preferences.copyAddressCount)

    for (const [key, value] of Object.entries(preferences.rawFlags)) {
        if (isPersistable(value)) {
            settings.setPreference(`${LEGACY_NAMESPACE}rawFlags.${key}`, value)
        }
    }
}
