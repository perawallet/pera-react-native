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
import { registerTestPlatform } from '@perawallet/wallet-core-platform-integration'

describe('services/settings/usePreferences', () => {
    beforeEach(() => {
        vi.resetModules()
        registerTestPlatform()
    })

    test('hasPreference returns false for non-existent preference', async () => {
        const { initSettingsStore } = await import('../../store')
        const { usePreferences } = await import('../usePreferences')

        initSettingsStore()

        const { result } = renderHook(() => usePreferences())

        expect(result.current.hasPreference('nonExistent')).toBe(false)
    })

    test('hasPreference returns true for existing preference', async () => {
        const { initSettingsStore } = await import('../../store')
        const { usePreferences } = await import('../usePreferences')

        initSettingsStore()

        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.hasPreference('testKey')).toBe(true)
    })

    test('getPreference retrieves preference value', async () => {
        const { initSettingsStore } = await import('../../store')
        const { usePreferences } = await import('../usePreferences')

        initSettingsStore()

        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.getPreference('testKey')).toBe('testValue')
    })

    test('setPreference adds a new preference', async () => {
        const { initSettingsStore } = await import('../../store')
        const { usePreferences } = await import('../usePreferences')

        initSettingsStore()

        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setPreference('newKey', 123)
        })

        expect(result.current.getPreference('newKey')).toBe(123)
    })

    test('deletePreference removes a preference', async () => {
        const { initSettingsStore } = await import('../../store')
        const { usePreferences } = await import('../usePreferences')

        initSettingsStore()

        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.hasPreference('testKey')).toBe(true)

        act(() => {
            result.current.deletePreference('testKey')
        })

        expect(result.current.hasPreference('testKey')).toBe(false)
    })

    test('clearAll removes all preferences', async () => {
        const { initSettingsStore } = await import('../../store')
        const { usePreferences } = await import('../usePreferences')

        initSettingsStore()

        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setPreference('key1', 'value1')
            result.current.setPreference('key2', 'value2')
        })

        expect(result.current.hasPreference('key1')).toBe(true)
        expect(result.current.hasPreference('key2')).toBe(true)

        act(() => {
            result.current.clearAllPreferences()
        })

        expect(result.current.hasPreference('key1')).toBe(false)
        expect(result.current.hasPreference('key2')).toBe(false)
    })
})
