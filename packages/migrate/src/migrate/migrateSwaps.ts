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

import { useSettingsStore } from '@perawallet/wallet-core-settings'
import { useSwapsStore } from '@perawallet/wallet-core-swaps'
import type { LegacyPreferences } from '@perawallet/wallet-extension-platform'

const SWAP_INTRODUCTION_SEEN_KEY = 'swap-introduction-seen'

export const migrateSwaps = (preferences: LegacyPreferences): void => {
    if (preferences.swapSlippageTolerance !== null) {
        useSwapsStore
            .getState()
            .setSlippage(String(preferences.swapSlippageTolerance))
    }

    const settings = useSettingsStore.getState()
    if (preferences.swapTermsAccepted === true) {
        settings.setPreference(SWAP_INTRODUCTION_SEEN_KEY, true)
    }
    if (preferences.swapLastUsedAddress !== null) {
        settings.setPreference(
            'legacy.swap.lastUsedAddress',
            preferences.swapLastUsedAddress,
        )
    }
    if (preferences.swapUseLocalCurrency !== null) {
        settings.setPreference(
            'legacy.swap.useLocalCurrency',
            preferences.swapUseLocalCurrency,
        )
    }
}
