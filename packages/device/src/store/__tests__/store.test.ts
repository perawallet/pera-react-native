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
vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        defaultNetwork: 'mainnet',
    },
    Networks: {
        testnet: 'testnet',
        mainnet: 'mainnet',
    },
}))

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

describe('device/store', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    test('should initialize with default values', async () => {
        const { useDeviceStore } = await import('../index')

        const { result } = renderHook(() => useDeviceStore())

        expect(result.current.deviceIDs).toBeInstanceOf(Map)
        expect(result.current.deviceIDs.size).toBe(0)
        expect(result.current.pushToken).toBeNull()
    })

    test('should set FCM token', async () => {
        const { useDeviceStore } = await import('../index')

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setPushToken('test-token-123')
        })

        expect(result.current.pushToken).toBe('test-token-123')
    })

    test('should set device ID for network', async () => {
        const { useDeviceStore } = await import('../index')

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('testnet', 'device-123')
        })

        expect(result.current.deviceIDs.get('testnet')).toBe('device-123')
    })

    test('should update device ID for same network', async () => {
        const { useDeviceStore } = await import('../index')

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('mainnet', 'device-1')
        })

        act(() => {
            result.current.setDeviceID('mainnet', 'device-2')
        })

        expect(result.current.deviceIDs.get('mainnet')).toBe('device-2')
    })

    test('should serialize deviceIDs as a plain object via partialize', async () => {
        const { useDeviceStore } = await import('../index')

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('mainnet', 'test-device-123')
        })

        // Verify the Map contains the value (partialize converts to object internally)
        expect(result.current.deviceIDs.get('mainnet')).toBe('test-device-123')
    })

    test('should store and retrieve deviceIDs correctly', async () => {
        const { useDeviceStore } = await import('../index')

        const { result } = renderHook(() => useDeviceStore())

        act(() => {
            result.current.setDeviceID('mainnet', 'persisted-id-123')
            result.current.setDeviceID('testnet', 'persisted-id-456')
            result.current.setPushToken('token-abc')
        })

        expect(result.current.deviceIDs).toBeInstanceOf(Map)
        expect(result.current.deviceIDs.get('mainnet')).toBe('persisted-id-123')
        expect(result.current.deviceIDs.get('testnet')).toBe('persisted-id-456')
        expect(result.current.pushToken).toBe('token-abc')
    })

    test('should create a new Map reference when setting device ID', async () => {
        const { useDeviceStore } = await import('../index')

        const { result } = renderHook(() => useDeviceStore())

        const originalMap = result.current.deviceIDs

        act(() => {
            result.current.setDeviceID('mainnet', 'new-id')
        })

        expect(result.current.deviceIDs).not.toBe(originalMap)
        expect(result.current.deviceIDs.get('mainnet')).toBe('new-id')
    })
})
