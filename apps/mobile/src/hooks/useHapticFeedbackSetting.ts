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

import { useCallback } from 'react'
import {
    usePreferences,
    useSettingsStore,
} from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'

export type UseHapticFeedbackSettingResult = {
    isEnabled: boolean
    setIsEnabled: (isEnabled: boolean) => void
}

// Nothing stored means on, so installs that predate the setting keep haptics.
const isOn = (stored: unknown): boolean => stored !== false

/**
 * Non-reactive read for callers that only need the value when they act, so
 * they don't subscribe to the preferences map and re-render on unrelated writes.
 */
export const isHapticFeedbackEnabled = (): boolean =>
    isOn(
        useSettingsStore
            .getState()
            .getPreference(UserPreferences.hapticFeedbackEnabled),
    )

export const useHapticFeedbackSetting = (): UseHapticFeedbackSettingResult => {
    const { getPreference, setPreference } = usePreferences()

    const setIsEnabled = useCallback(
        (isEnabled: boolean) =>
            setPreference(UserPreferences.hapticFeedbackEnabled, isEnabled),
        [setPreference],
    )

    return {
        isEnabled: isOn(getPreference(UserPreferences.hapticFeedbackEnabled)),
        setIsEnabled,
    }
}
