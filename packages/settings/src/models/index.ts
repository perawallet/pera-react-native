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

import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'

export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * `'system'` mirrors ThemeMode's sentinel. Anything else is a locale tag —
 * typed as `string`, not a closed union, because the supported set is owned
 * by the app's i18n layer (apps/mobile/src/i18n/locales.ts), not by this
 * package; packages/* must not depend on apps/mobile. Validating a tag
 * against that set is the caller's job.
 */
export type LanguagePreference = 'system' | string

export type SettingsState = BaseStoreState & {
    preferences: Record<string, string | boolean | number>
    theme: ThemeMode
    privacyMode: boolean
    language: LanguagePreference
    setTheme: (theme: ThemeMode) => void
    setPrivacyMode: (enabled: boolean) => void
    setLanguage: (language: LanguagePreference) => void
    getPreference: (key: string) => Nullable<string | boolean | number>
    setPreference: (key: string, value: string | boolean | number) => void
    deletePreference: (key: string) => void
    clearAllPreferences: () => void
}
