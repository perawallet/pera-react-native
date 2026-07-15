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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryKeyValueStorage } from '@test-utils'
import { createRemoteConfigStore } from '../store'

const registerStoreMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    const { createMockPersistStorage } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared/test-utils')
    >('@perawallet/wallet-core-shared/test-utils')
    return {
        ...original,
        registerStore: registerStoreMock,
        createPersistStorage: createMockPersistStorage,
    }
})

describe('remote-config/store factory', () => {
    let storage: MemoryKeyValueStorage

    beforeEach(() => {
        storage = new MemoryKeyValueStorage()
    })

    test('initializes with empty config overrides', () => {
        const useStore = createRemoteConfigStore(storage)
        const { result } = renderHook(() => useStore())

        expect(result.current.configOverrides).toEqual({})
    })

    test('setConfigOverride stores string/boolean/number values', () => {
        const useStore = createRemoteConfigStore(storage)
        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.setConfigOverride('str', 'v')
            result.current.setConfigOverride('bool', true)
            result.current.setConfigOverride('num', 123)
        })

        expect(result.current.configOverrides).toEqual({
            str: 'v',
            bool: true,
            num: 123,
        })
    })

    test('setConfigOverride replaces an existing key', () => {
        const useStore = createRemoteConfigStore(storage)
        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.setConfigOverride('k', 'first')
            result.current.setConfigOverride('k', 'second')
        })

        expect(result.current.configOverrides['k']).toBe('second')
    })

    test('setConfigOverride(null) removes the key', () => {
        const useStore = createRemoteConfigStore(storage)
        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.setConfigOverride('k', 'v')
            result.current.setConfigOverride('k', null)
        })

        expect(result.current.configOverrides['k']).toBeUndefined()
    })

    test('resetState returns to the initial empty state', () => {
        const useStore = createRemoteConfigStore(storage)
        const { result } = renderHook(() => useStore())

        act(() => {
            result.current.setConfigOverride('k', 'v')
            result.current.resetState()
        })

        expect(result.current.configOverrides).toEqual({})
    })
})

describe('remote-config/store singleton', () => {
    beforeEach(() => {
        vi.resetModules()
        registerStoreMock.mockReset()
    })

    test('registers a clearStorage and resetState callback', async () => {
        const { useRemoteConfigStore } = await import('../store')

        const registration = registerStoreMock.mock.calls.at(-1)?.[0]
        expect(registration?.name).toBe('remote-config-store')

        act(() => {
            useRemoteConfigStore.getState().setConfigOverride('feature', true)
        })
        act(() => registration.resetState())
        expect(useRemoteConfigStore.getState().configOverrides).toEqual({})
        expect(() => registration.clearStorage()).not.toThrow()
    })

    test('setConfigOverride on the singleton logs and updates state', async () => {
        const { useRemoteConfigStore } = await import('../store')

        act(() => {
            useRemoteConfigStore.getState().setConfigOverride('x', 1)
            useRemoteConfigStore.getState().setConfigOverride('x', null)
        })

        expect(useRemoteConfigStore.getState().configOverrides).toEqual({})
    })
})
