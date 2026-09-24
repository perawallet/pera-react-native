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

import { vi, describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useDeviceStore } from '../../store'
import { useDeviceID } from '../useDeviceID'

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

describe('device/hooks/useDeviceID', () => {
    // resetState rather than vi.resetModules + per-test dynamic imports: the
    // latter re-transformed the store's whole module graph every test and
    // intermittently overran the 5s timeout under the full parallel run.
    beforeEach(() => {
        useDeviceStore.getState().resetState()
    })

    test('should return null when no device ID is set', () => {
        const { result } = renderHook(() => useDeviceID('mainnet'))

        expect(result.current).toBeNull()
    })

    test('should return device ID for specific network', () => {
        // Set device ID using store
        const storeHook = renderHook(() => useDeviceStore())
        act(() => {
            storeHook.result.current.setDeviceID('mainnet', 'device-main-123')
            storeHook.result.current.setDeviceID('testnet', 'device-test-456')
        })

        const mainnetResult = renderHook(() => useDeviceID('mainnet'))
        const testnetResult = renderHook(() => useDeviceID('testnet'))

        expect(mainnetResult.result.current).toBe('device-main-123')
        expect(testnetResult.result.current).toBe('device-test-456')
    })

    test('should return null for network without device ID', () => {
        // Set device ID only for mainnet
        const storeHook = renderHook(() => useDeviceStore())
        act(() => {
            storeHook.result.current.setDeviceID('mainnet', 'device-123')
        })

        const testnetResult = renderHook(() => useDeviceID('testnet'))

        expect(testnetResult.result.current).toBeNull()
    })

    test('should update when device ID changes', () => {
        const storeHook = renderHook(() => useDeviceStore())
        const deviceIDHook = renderHook(() => useDeviceID('mainnet'))

        expect(deviceIDHook.result.current).toBeNull()

        act(() => {
            storeHook.result.current.setDeviceID('mainnet', 'device-new-123')
        })

        deviceIDHook.rerender()

        expect(deviceIDHook.result.current).toBe('device-new-123')
    })
})
