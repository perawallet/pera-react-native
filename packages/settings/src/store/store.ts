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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
    SettingsState,
    ThemeMode,
    LanguagePreference,
    ConfirmationMode,
} from '../models'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'settings-store'

const initialState = {
    theme: 'system' as ThemeMode,
    privacyMode: false,
    language: 'system' as LanguagePreference,
    confirmationMode: 'slide' as ConfirmationMode,
    preferences: {} as Record<string, string | boolean | number>,
}

// Carried over so a device that already unlocked the tools stays unlocked.
const RENAMED_PREFERENCES: Readonly<Record<string, string>> = {
    'developer-menu-enabled': 'debug-tools-enabled',
}

const withRenamedPreferences = (state: SettingsState): SettingsState => {
    if (!state.preferences) return state
    const preferences = { ...state.preferences }
    for (const [from, to] of Object.entries(RENAMED_PREFERENCES)) {
        if (!(from in preferences)) continue
        preferences[to] ??= preferences[from]
        delete preferences[from]
    }
    return { ...state, preferences }
}

/**
 * v1 persisted state has no `language` field; v2 kept preferences the app has
 * since renamed. Exported (rather than inlined in the persist options) so the
 * migration itself is directly unit-testable.
 */
export const migrateSettingsState = (
    persistedState: unknown,
    version: number,
): SettingsState => {
    let state = persistedState as SettingsState
    if (version < 2) {
        state = { ...state, language: 'system' }
    }
    if (version < 3) {
        state = withRenamedPreferences(state)
    }
    return state
}

export const useSettingsStore: UseBoundStore<
    WithPersist<StoreApi<SettingsState>, unknown>
> = create<SettingsState>()(
    persist(
        (set, get) => ({
            ...initialState,
            setTheme: (theme: ThemeMode) => set({ theme }),
            setPrivacyMode: (privacyMode: boolean) => set({ privacyMode }),
            setLanguage: (language: LanguagePreference) => set({ language }),
            setConfirmationMode: (confirmationMode: ConfirmationMode) =>
                set({ confirmationMode }),
            setPreference: (key: string, value: string | boolean | number) => {
                set({ preferences: { ...get().preferences, [key]: value } })
            },
            getPreference: (key: string) => {
                return get().preferences[key] ?? null
            },
            deletePreference: (key: string) => {
                const existing = get().preferences
                delete existing[key]
                set({
                    preferences: {
                        ...existing,
                    },
                })
            },
            clearAllPreferences: () => {
                set({ preferences: {} })
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: 3,
            migrate: migrateSettingsState,
            partialize: state => ({
                theme: state.theme,
                privacyMode: state.privacyMode,
                language: state.language,
                confirmationMode: state.confirmationMode,
                preferences: state.preferences,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useSettingsStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useSettingsStore.getState().resetState(),
})
