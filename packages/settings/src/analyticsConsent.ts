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

import { getProvider } from '@perawallet/wallet-extension-provider'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useSettingsStore } from './store'

export type AnalyticsConsent = 'granted' | 'denied'

export const ANALYTICS_CONSENT_PREFERENCE_KEY = 'analyticsConsent'

/** Null until the user has answered; collection stays off until then. */
export const readAnalyticsConsent = (
    preferences: Record<string, string | boolean | number>,
): Nullable<AnalyticsConsent> => {
    const value = preferences[ANALYTICS_CONSENT_PREFERENCE_KEY]
    return value === 'granted' || value === 'denied' ? value : null
}

const applyConsent = (
    preferences: Record<string, string | boolean | number>,
): void => {
    getProvider().analytics.setCollectionEnabled(
        readAnalyticsConsent(preferences) === 'granted',
    )
}

/**
 * Mirrors the stored consent into the analytics service now and on every
 * change, including a wallet reset clearing it. Runs before the React tree
 * mounts so the first screen view of a session is already gated correctly.
 */
export const syncAnalyticsConsent = (): (() => void) => {
    applyConsent(useSettingsStore.getState().preferences)
    return useSettingsStore.subscribe((state, previous) => {
        if (
            state.preferences[ANALYTICS_CONSENT_PREFERENCE_KEY] !==
            previous.preferences[ANALYTICS_CONSENT_PREFERENCE_KEY]
        ) {
            applyConsent(state.preferences)
        }
    })
}
