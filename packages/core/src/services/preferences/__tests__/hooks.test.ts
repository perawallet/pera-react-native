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

import { describe, test, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryKeyValueStorage, registerTestPlatform } from '@test-utils'

describe('services/preferences/hooks', () => {
    test('usePreferences returns hasPreference, getPreference, setPreference, deletePreference', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { usePreferences } = await import('../hooks')

        const { result } = renderHook(() => usePreferences())

        expect(result.current).toHaveProperty('hasPreference')
        expect(result.current).toHaveProperty('getPreference')
        expect(result.current).toHaveProperty('setPreference')
        expect(result.current).toHaveProperty('deletePreference')
        expect(typeof result.current.hasPreference).toBe('function')
        expect(typeof result.current.getPreference).toBe('function')
        expect(typeof result.current.setPreference).toBe('function')
        expect(typeof result.current.deletePreference).toBe('function')
    })

    test('hasPreference returns true when preference exists, false when it does not', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { usePreferences } = await import('../hooks')

        // Set a preference in the store
        useAppStore.setState({
            preferences: { 'test-key': 'test-value' }
        })

        const { result } = renderHook(() => usePreferences())

        expect(result.current.hasPreference('test-key')).toBe(true)
        expect(result.current.hasPreference('nonexistent-key')).toBe(false)
    })

    test('getPreference returns the correct value or null', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { usePreferences } = await import('../hooks')

        // Set preferences in the store
        useAppStore.setState({
            preferences: {
                'key1': 'value1',
                'key2': 'value2'
            }
        })

        const { result } = renderHook(() => usePreferences())

        expect(result.current.getPreference('key1')).toBe('value1')
        expect(result.current.getPreference('key2')).toBe('value2')
        expect(result.current.getPreference('nonexistent')).toBeNull()
    })

    test('setPreference updates the store correctly', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { usePreferences } = await import('../hooks')

        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.setPreference('new-key', 'new-value')
        })

        expect(useAppStore.getState().preferences['new-key']).toBe('new-value')

        // Update existing key
        act(() => {
            result.current.setPreference('new-key', 'updated-value')
        })

        expect(useAppStore.getState().preferences['new-key']).toBe('updated-value')
    })

    test('deletePreference removes the preference from store', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { usePreferences } = await import('../hooks')

        // Set initial preferences
        useAppStore.setState({
            preferences: {
                'keep': 'value',
                'remove': 'gone'
            }
        })

        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.deletePreference('remove')
        })

        expect(useAppStore.getState().preferences).toEqual({
            'keep': 'value'
        })
        expect(result.current.getPreference('remove')).toBeNull()
    })

    test('deletePreference handles non-existent keys gracefully', async () => {
        vi.resetModules()

        const dummySecure = {
            setItem: vi.fn(async (_k: string, _v: string) => {}),
            getItem: vi.fn(async (_k: string) => null),
            removeItem: vi.fn(async (_k: string) => {}),
            authenticate: vi.fn(async () => true),
        }

        registerTestPlatform({
            keyValueStorage: new MemoryKeyValueStorage() as any,
            secureStorage: dummySecure as any,
        })

        const { useAppStore } = await import('../../../store')
        const { usePreferences } = await import('../hooks')

        // Set initial preferences
        useAppStore.setState({
            preferences: { 'existing': 'value' }
        })

        const { result } = renderHook(() => usePreferences())

        act(() => {
            result.current.deletePreference('nonexistent')
        })

        // Should not affect existing preferences
        expect(useAppStore.getState().preferences).toEqual({
            'existing': 'value'
        })
    })
})