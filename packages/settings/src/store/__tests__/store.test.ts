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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { registerTestPlatform } from '@test-utils'

describe('services/settings/store', () => {
    beforeEach(() => {
        vi.resetModules()
        registerTestPlatform()
    })

    test('initSettingsStore initializes the store with defaults', async () => {
        const { initSettingsStore, useSettingsStore } = await import('../store')

        initSettingsStore()

        const { result } = renderHook(() => useSettingsStore())

        expect(result.current.theme).toBe('system')
        expect(result.current.privacyMode).toBe(false)
        expect(result.current.preferences).toEqual({})
    })

    test('setTheme updates theme state', async () => {
        const { initSettingsStore, useSettingsStore } = await import('../store')

        initSettingsStore()

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
        const { initSettingsStore, useSettingsStore } = await import('../store')

        initSettingsStore()

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
        const { initSettingsStore, useSettingsStore } = await import('../store')

        initSettingsStore()

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.preferences.testKey).toBe('testValue')
    })

    test('getPreference retrieves a preference', async () => {
        const { initSettingsStore, useSettingsStore } = await import('../store')

        initSettingsStore()

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.getPreference('testKey')).toBe('testValue')
        expect(result.current.getPreference('nonExistent')).toBeNull()
    })

    test('deletePreference removes a preference', async () => {
        const { initSettingsStore, useSettingsStore } = await import('../store')

        initSettingsStore()

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
        const { initSettingsStore, useSettingsStore } = await import('../store')

        initSettingsStore()

        const { result } = renderHook(() => useSettingsStore())

        act(() => {
            result.current.setTheme('dark')
            result.current.setPrivacyMode(true)
            result.current.setPreference('test', 'value')
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.theme).toBe('system')
        expect(result.current.privacyMode).toBe(false)
        expect(result.current.preferences).toEqual({})
    })
})
