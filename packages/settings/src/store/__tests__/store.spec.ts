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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: createMockPersistStorage,
    }
})

describe('services/settings/store', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('store initializes with defaults', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        expect(result.current.theme).toBe('system')
        expect(result.current.privacyMode).toBe(false)
        expect(result.current.preferences).toEqual({})
    })

    test('setTheme updates theme state', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setTheme('dark')
        })

        expect(result.current.theme).toBe('dark')

        act(() => {
            result.current.setTheme('light')
        })

        expect(result.current.theme).toBe('light')
    })

    test('setPrivacyMode updates privacy mode state', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setPrivacyMode(true)
        })

        expect(result.current.privacyMode).toBe(true)

        act(() => {
            result.current.setPrivacyMode(false)
        })

        expect(result.current.privacyMode).toBe(false)
    })

    test('setPreference adds a preference', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.preferences.testKey).toBe('testValue')
    })

    test('getPreference retrieves a preference', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.getPreference('testKey')).toBe('testValue')
        expect(result.current.getPreference('nonExistent')).toBeNull()
    })

    test('deletePreference removes a preference', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.preferences.testKey).toBe('testValue')

        act(() => {
            result.current.deletePreference('testKey')
        })

        expect(result.current.preferences.testKey).toBeUndefined()
    })

    test('resetState reverts to initial values', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setTheme('dark')
            result.current.setPrivacyMode(true)
            result.current.setPreference('test', 'value')
            result.current.setLanguage('de')
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.theme).toBe('system')
        expect(result.current.privacyMode).toBe(false)
        expect(result.current.preferences).toEqual({})
        expect(result.current.language).toBe('system')
    })

    test('store initializes with language "system"', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        expect(result.current.language).toBe('system')
    })

    test('store initializes with confirmationMode "slide"', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        expect(result.current.confirmationMode).toBe('slide')
    })

    test('setConfirmationMode updates confirmation mode state', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setConfirmationMode('tap')
        })

        expect(result.current.confirmationMode).toBe('tap')

        act(() => {
            result.current.setConfirmationMode('slide')
        })

        expect(result.current.confirmationMode).toBe('slide')
    })

    test('resetState reverts confirmationMode to "slide"', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setConfirmationMode('tap')
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.confirmationMode).toBe('slide')
    })

    test('setLanguage updates language state', async () => {
        const { useSettingsStore } = await import('../store')

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setLanguage('de')
        })

        expect(result.current.language).toBe('de')

        act(() => {
            result.current.setLanguage('system')
        })

        expect(result.current.language).toBe('system')
    })
})

describe('services/settings/store - migrateSettingsState', () => {
    test('injects language "system" for pre-v2 persisted state', async () => {
        const { migrateSettingsState } = await import('../store')

        const migrated = migrateSettingsState(
            { theme: 'dark', privacyMode: true, preferences: { a: '1' } },
            1,
        )

        expect(migrated).toEqual({
            theme: 'dark',
            privacyMode: true,
            preferences: { a: '1' },
            language: 'system',
        })
    })

    test('passes through state already at v2 unchanged', async () => {
        const { migrateSettingsState } = await import('../store')

        const state = {
            theme: 'light',
            privacyMode: false,
            preferences: {},
            language: 'de',
        }

        expect(migrateSettingsState(state, 2)).toEqual(state)
    })
})
