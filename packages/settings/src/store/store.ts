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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { keyValueStorage } from '@perawallet/wallet-extension-platform-resources'
import type { SettingsState, ThemeMode } from '../models'
import { registerStore, type WithPersist } from '@perawallet/wallet-core-shared'

const STORE_NAME = 'settings-store'

const initialState = {
    theme: 'system' as ThemeMode,
    privacyMode: false,
    preferences: {} as Record<string, string | boolean | number>,
}

export const useSettingsStore: UseBoundStore<
    WithPersist<StoreApi<SettingsState>, unknown>
> = create<SettingsState>()(
    persist(
        (set, get) => ({
            ...initialState,
            setTheme: (theme: ThemeMode) => set({ theme }),
            setPrivacyMode: (privacyMode: boolean) => set({ privacyMode }),
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
            storage: createJSONStorage(() => keyValueStorage),
            version: 1,
            partialize: state => ({
                theme: state.theme,
                privacyMode: state.privacyMode,
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
