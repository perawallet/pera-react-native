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

import { describe, it, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

const memoryStorage = new Map<string, string>()
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: (key: string) => memoryStorage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                memoryStorage.set(key, value)
            },
            removeItem: (key: string) => {
                memoryStorage.delete(key)
            },
        },
    }),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-shared',
    )
    return {
        ...actual,
        registerStore: vi.fn(),
    }
})

import { useLedgerPairing } from '../useLedgerPairing'
import { useLedgerPairingStore } from '../../store/pairingStore'

const device: HardwareWalletDevice = {
    id: 'device-1',
    name: 'Ledger Nano X',
    model: 'nanoX',
    rssi: -50,
    manufacturer: 'ledger',
    transportType: 'ble',
} as HardwareWalletDevice

describe('useLedgerPairing', () => {
    beforeEach(() => {
        useLedgerPairingStore.getState().resetState()
        memoryStorage.clear()
    })

    it('invokes onReady immediately when the device is already paired', () => {
        useLedgerPairingStore.getState().markPaired('device-1')
        const onReady = vi.fn()

        const { result } = renderHook(() => useLedgerPairing())
        act(() => {
            result.current.requestPairing(device, onReady)
        })

        expect(onReady).toHaveBeenCalledWith(device)
        expect(result.current.pendingPairingDevice).toBeNull()
    })

    it('parks an unknown device as pending without invoking onReady', () => {
        const onReady = vi.fn()

        const { result } = renderHook(() => useLedgerPairing())
        act(() => {
            result.current.requestPairing(device, onReady)
        })

        expect(onReady).not.toHaveBeenCalled()
        expect(result.current.pendingPairingDevice?.id).toBe('device-1')
    })

    it('marks the device as paired and invokes onReady on confirm', () => {
        const onReady = vi.fn()

        const { result } = renderHook(() => useLedgerPairing())
        act(() => {
            result.current.requestPairing(device, vi.fn())
        })
        act(() => {
            result.current.confirmPairing(onReady)
        })

        expect(useLedgerPairingStore.getState().isPaired('device-1')).toBe(true)
        expect(onReady).toHaveBeenCalledWith(device)
        expect(result.current.pendingPairingDevice).toBeNull()
    })

    it('clears the pending device on cancel without marking paired', () => {
        const { result } = renderHook(() => useLedgerPairing())
        act(() => {
            result.current.requestPairing(device, vi.fn())
        })
        act(() => {
            result.current.cancelPairing()
        })

        expect(useLedgerPairingStore.getState().isPaired('device-1')).toBe(
            false,
        )
        expect(result.current.pendingPairingDevice).toBeNull()
    })

    it('is a no-op when confirm is called with no pending device', () => {
        const onReady = vi.fn()
        const { result } = renderHook(() => useLedgerPairing())

        act(() => {
            result.current.confirmPairing(onReady)
        })

        expect(onReady).not.toHaveBeenCalled()
    })

    test('USB devices skip pairing-instructions and invoke onReady directly', () => {
        useLedgerPairingStore.setState({
            pairedDeviceIds: [],
            pendingPairingDevice: null,
        })

        const { result } = renderHook(() => useLedgerPairing())
        const onReady = vi.fn()

        act(() => {
            result.current.requestPairing(
                {
                    id: 'usb-dev-1',
                    name: 'Nano S Plus',
                    manufacturer: 'ledger',
                    transportType: 'usb',
                    model: 'nanoSPlus',
                    rssi: null,
                },
                onReady,
            )
        })

        expect(onReady).toHaveBeenCalledTimes(1)
        expect(useLedgerPairingStore.getState().pendingPairingDevice).toBeNull()
    })
})
