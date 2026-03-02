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

import { vi, describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    registerTestPlatform,
    MemoryKeyValueStorage,
} from '../../../test-utils'

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        defaultNetwork: 'mainnet',
    },
    Networks: {
        testnet: 'testnet',
        mainnet: 'mainnet',
    },
}))

describe('device/store', () => {
    beforeEach(() => {
        // Reset modules to get fresh store instance
        vi.resetModules()
    })

    test('should initialize with default values', async () => {
        const platform = registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore(platform.keyValueStorage)

        const { result } = renderHook(() => useDeviceStore())

        expect(result.current.deviceIDs).toBeInstanceOf(Map)
        expect(result.current.deviceIDs.size).toBe(0)
        expect(result.current.pushToken).toBeNull()
        expect(result.current.network).toBe('mainnet')
    })

    test('should set FCM token', async () => {
        const platform = registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore(platform.keyValueStorage)

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setPushToken('test-token-123')
        })

        expect(result.current.pushToken).toBe('test-token-123')
    })

    test('should set device ID for network', async () => {
        const platform = registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore(platform.keyValueStorage)

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('testnet', 'device-123')
        })

        expect(result.current.deviceIDs.get('testnet')).toBe('device-123')
    })

    test('should update device ID for same network', async () => {
        const platform = registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore(platform.keyValueStorage)

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('mainnet', 'device-1')
        })

        act(() => {
            result.current.setDeviceID('mainnet', 'device-2')
        })

        expect(result.current.deviceIDs.get('mainnet')).toBe('device-2')
    })

    test('should set network', async () => {
        const platform = registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore(platform.keyValueStorage)

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setNetwork('testnet')
        })

        expect(result.current.network).toBe('testnet')
    })

    test('should serialize deviceIDs as a plain object via partialize', async () => {
        const storage = new MemoryKeyValueStorage()
        registerTestPlatform({ keyValueStorage: storage })

        const { createDeviceStore } = await import('../store')

        const store = createDeviceStore(storage)

        act(() => {
            store.getState().setDeviceID('mainnet', 'test-device-123')
        })

        const persisted = storage.getItem('device-store')
        expect(persisted).not.toBeNull()

        const parsed = JSON.parse(persisted!)
        expect(parsed.state.deviceIDs).toEqual({ mainnet: 'test-device-123' })
    })

    test('should rehydrate deviceIDs from persisted storage', async () => {
        const storage = new MemoryKeyValueStorage()
        storage.setItem(
            'device-store',
            JSON.stringify({
                state: {
                    deviceIDs: {
                        mainnet: 'persisted-id-123',
                        testnet: 'persisted-id-456',
                    },
                    pushToken: 'token-abc',
                    network: 'mainnet',
                },
                version: 1,
            }),
        )

        registerTestPlatform({ keyValueStorage: storage })

        const { createDeviceStore } = await import('../store')

        const store = createDeviceStore(storage)
        const state = store.getState()

        expect(state.deviceIDs).toBeInstanceOf(Map)
        expect(state.deviceIDs.get('mainnet')).toBe('persisted-id-123')
        expect(state.deviceIDs.get('testnet')).toBe('persisted-id-456')
        expect(state.pushToken).toBe('token-abc')
    })

    test('should create a new Map reference when setting device ID', async () => {
        const platform = registerTestPlatform()

        const { initDeviceStore, useDeviceStore } = await import('../index')

        initDeviceStore(platform.keyValueStorage)

        const { result } = renderHook(() => useDeviceStore())

        const originalMap = result.current.deviceIDs

        act(() => {
            result.current.setDeviceID('mainnet', 'new-id')
        })

        expect(result.current.deviceIDs).not.toBe(originalMap)
        expect(result.current.deviceIDs.get('mainnet')).toBe('new-id')
    })
})
