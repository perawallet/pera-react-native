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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { HardwareWalletAdapterState } from '@perawallet/wallet-core-hardware-wallet'

const {
    mockGetProvider,
    mockObserveBluetoothState,
    mockRequestBluetoothEnable,
    mockUnsubscribe,
    registry,
} = vi.hoisted(() => {
    const mockUnsubscribe = vi.fn()
    const mockObserveBluetoothState = vi.fn()
    const mockRequestBluetoothEnable = vi.fn()
    const registry = {
        getProvider: vi.fn(),
    }
    return {
        mockGetProvider: vi.fn(() => ({
            hardwareWalletRegistry: registry,
        })),
        mockObserveBluetoothState,
        mockRequestBluetoothEnable,
        mockUnsubscribe,
        registry,
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: mockGetProvider,
}))

import { useBluetoothState } from '../useBluetoothState'

describe('useBluetoothState', () => {
    let emit: (state: HardwareWalletAdapterState) => void

    beforeEach(() => {
        vi.clearAllMocks()
        // Capture the subscriber so tests can drive state changes.
        mockObserveBluetoothState.mockImplementation(
            (onChange: (state: HardwareWalletAdapterState) => void) => {
                emit = onChange
                return mockUnsubscribe
            },
        )
        registry.getProvider.mockReturnValue({
            observeBluetoothState: mockObserveBluetoothState,
            requestBluetoothEnable: mockRequestBluetoothEnable,
        })
    })

    it('subscribes to the Ledger BLE provider on mount', () => {
        renderHook(() => useBluetoothState())

        expect(registry.getProvider).toHaveBeenCalledWith('ledger', 'ble')
        expect(mockObserveBluetoothState).toHaveBeenCalledTimes(1)
    })

    it('reflects the emitted adapter state and derives readiness', () => {
        const { result } = renderHook(() => useBluetoothState())

        act(() => emit('poweredOn'))

        expect(result.current.adapterState).toBe('poweredOn')
        expect(result.current.isBluetoothReady).toBe(true)
        expect(result.current.isBluetoothUnavailable).toBe(false)
    })

    it('marks powered-off as unavailable but not ready', () => {
        const { result } = renderHook(() => useBluetoothState())

        act(() => emit('poweredOff'))

        expect(result.current.isBluetoothReady).toBe(false)
        expect(result.current.isBluetoothUnavailable).toBe(true)
    })

    it('treats transient states as neither ready nor unavailable', () => {
        const { result } = renderHook(() => useBluetoothState())

        act(() => emit('resetting'))

        expect(result.current.isBluetoothReady).toBe(false)
        expect(result.current.isBluetoothUnavailable).toBe(false)
    })

    it('unsubscribes on unmount', () => {
        const { unmount } = renderHook(() => useBluetoothState())

        unmount()

        expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    })

    it('degrades gracefully when no BLE provider is registered', () => {
        registry.getProvider.mockReturnValue(undefined)

        const { result } = renderHook(() => useBluetoothState())

        expect(result.current.adapterState).toBe('unknown')
        expect(result.current.isBluetoothReady).toBe(false)
        expect(mockObserveBluetoothState).not.toHaveBeenCalled()
    })

    it('degrades gracefully when the provider lacks observeBluetoothState', () => {
        registry.getProvider.mockReturnValue({})

        const { result } = renderHook(() => useBluetoothState())

        expect(result.current.adapterState).toBe('unknown')
        expect(result.current.isBluetoothReady).toBe(false)
    })

    it('delegates requestEnable to the BLE provider', async () => {
        mockRequestBluetoothEnable.mockResolvedValue(true)

        const { result } = renderHook(() => useBluetoothState())
        const enabled = await result.current.requestEnable()

        expect(mockRequestBluetoothEnable).toHaveBeenCalledTimes(1)
        expect(enabled).toBe(true)
    })

    it('resolves requestEnable to false when the provider cannot enable', async () => {
        registry.getProvider.mockReturnValue({
            observeBluetoothState: mockObserveBluetoothState,
        })

        const { result } = renderHook(() => useBluetoothState())
        const enabled = await result.current.requestEnable()

        expect(enabled).toBe(false)
    })
})
