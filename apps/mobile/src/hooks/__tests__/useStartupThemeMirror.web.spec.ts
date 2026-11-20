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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    STARTUP_THEME_STORAGE_KEY,
    useStartupThemeMirror,
} from '@hooks/useStartupThemeMirror.web'

const { store } = vi.hoisted(() => {
    type Theme = 'light' | 'dark' | 'system'
    type Listener = (
        state: { theme: Theme },
        previous: { theme: Theme },
    ) => void
    const listeners = new Set<Listener>()
    const hydrationListeners = new Set<(state: { theme: Theme }) => void>()
    const store = {
        state: { theme: 'system' as Theme },
        isHydrated: false,
        getState: () => store.state,
        subscribe: (listener: Listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        setTheme: (theme: Theme) => {
            const previous = store.state
            store.state = { theme }
            listeners.forEach(listener => listener(store.state, previous))
        },
        finishHydration: (theme: Theme) => {
            store.setTheme(theme)
            store.isHydrated = true
            hydrationListeners.forEach(listener => listener(store.state))
        },
        persist: {
            hasHydrated: () => store.isHydrated,
            onFinishHydration: (
                listener: (state: { theme: Theme }) => void,
            ) => {
                hydrationListeners.add(listener)
                return () => hydrationListeners.delete(listener)
            },
        },
        reset: () => {
            listeners.clear()
            hydrationListeners.clear()
            store.state = { theme: 'system' }
            store.isHydrated = false
        },
    }
    return { store }
})

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettingsStore: store,
}))

describe('useStartupThemeMirror', () => {
    beforeEach(() => {
        localStorage.clear()
        delete document.documentElement.dataset.peraTheme
    })

    afterEach(() => {
        store.reset()
    })

    it('ignores the pre-hydration default and mirrors the hydrated theme', () => {
        localStorage.setItem(STARTUP_THEME_STORAGE_KEY, 'dark')
        renderHook(() => useStartupThemeMirror())

        store.setTheme('light')
        expect(localStorage.getItem(STARTUP_THEME_STORAGE_KEY)).toBe('dark')

        store.finishHydration('dark')

        expect(localStorage.getItem(STARTUP_THEME_STORAGE_KEY)).toBe('dark')
        expect(document.documentElement.dataset.peraTheme).toBe('dark')
    })

    it('mirrors a theme change after hydration', () => {
        store.isHydrated = true
        renderHook(() => useStartupThemeMirror())

        store.setTheme('light')

        expect(localStorage.getItem(STARTUP_THEME_STORAGE_KEY)).toBe('light')
        expect(document.documentElement.dataset.peraTheme).toBe('light')
    })

    it('clears the forced attribute when the theme returns to system', () => {
        store.isHydrated = true
        store.state = { theme: 'dark' }
        renderHook(() => useStartupThemeMirror())
        expect(document.documentElement.dataset.peraTheme).toBe('dark')

        store.setTheme('system')

        expect(localStorage.getItem(STARTUP_THEME_STORAGE_KEY)).toBe('system')
        expect(document.documentElement.dataset.peraTheme).toBeUndefined()
    })
})
