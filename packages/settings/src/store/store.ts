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

/**
 * v1 persisted state has no `language` field. Exported (rather than inlined
 * in the persist options) so the migration itself is directly unit-testable.
 */
export const migrateSettingsState = (
    persistedState: unknown,
    version: number,
): SettingsState => {
    if (version < 2) {
        return {
            ...(persistedState as SettingsState),
            language: 'system',
        }
    }
    return persistedState as SettingsState
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
            version: 2,
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
