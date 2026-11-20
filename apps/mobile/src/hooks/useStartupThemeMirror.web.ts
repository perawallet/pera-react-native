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

import { useEffect } from 'react'
import {
    useSettingsStore,
    type ThemeMode,
} from '@perawallet/wallet-core-settings'

// The extension's per-surface boot script (apps/browser/scripts/build.mjs)
// reads this key synchronously before React mounts, because the settings store
// persists through async storage. Keep the key and attribute in sync with it.
export const STARTUP_THEME_STORAGE_KEY = 'pera.startupTheme'

export const writeStartupTheme = (theme: ThemeMode): void => {
    try {
        localStorage.setItem(STARTUP_THEME_STORAGE_KEY, theme)
    } catch {
        // Storage can be unavailable; the pre-mount paint then follows the OS theme.
    }
    if (theme === 'system') {
        delete document.documentElement.dataset.peraTheme
    } else {
        document.documentElement.dataset.peraTheme = theme
    }
}

export const useStartupThemeMirror = (): void => {
    useEffect(() => {
        const { persist } = useSettingsStore
        // The pre-hydration default would overwrite a forced theme from the last session.
        if (persist.hasHydrated()) {
            writeStartupTheme(useSettingsStore.getState().theme)
        }
        const offHydration = persist.onFinishHydration(state =>
            writeStartupTheme(state.theme),
        )
        const offChange = useSettingsStore.subscribe((state, previous) => {
            if (state.theme !== previous.theme && persist.hasHydrated()) {
                writeStartupTheme(state.theme)
            }
        })
        return () => {
            offHydration()
            offChange()
        }
    }, [])
}
