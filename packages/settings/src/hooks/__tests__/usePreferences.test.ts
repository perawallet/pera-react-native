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

import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useSettingsStore } from '../../store'
import { usePreferences } from '../usePreferences'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: () => {
            const store = new Map<string, string>()
            return {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, value)
                },
                removeItem: (key: string) => {
                    store.delete(key)
                },
            }
        },
    }
})

describe('services/settings/usePreferences', () => {
    beforeEach(() => {
        useSettingsStore.getState().resetState()
    })

    test('hasPreference returns false for non-existent preference', () => {
        const { result } = renderHook(() => usePreferences())

        expect(result.current.hasPreference('nonExistent')).toBe(false)
    })

    test('hasPreference returns true for existing preference', () => {
        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.hasPreference('testKey')).toBe(true)
    })

    test('getPreference retrieves preference value', () => {
        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setPreference('testKey', 'testValue')
        })

        expect(result.current.getPreference('testKey')).toBe('testValue')
    })

    test('setPreference adds a new preference', () => {
        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setPreference('newKey', 123)
        })

        expect(result.current.getPreference('newKey')).toBe(123)
    })

    test('deletePreference removes a preference', () => {
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

    test('clearAll removes all preferences', () => {
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
