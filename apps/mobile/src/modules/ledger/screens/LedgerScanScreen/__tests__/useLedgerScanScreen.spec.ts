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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

const mockNavigate = vi.fn()
const mockStartScan = vi.fn()
const mockStopScan = vi.fn()

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../hooks', () => ({
    useLedgerConnection: () => ({
        devices: [],
        isScanning: false,
        startScan: mockStartScan,
        stopScan: mockStopScan,
        error: null,
    }),
}))

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

import { useLedgerPairingStore } from '@perawallet/wallet-core-ledger'
import { useLedgerScanScreen } from '../useLedgerScanScreen'

const makeDevice = (id: string): HardwareWalletDevice =>
    ({
        id,
        name: 'Fred Nano X',
        model: 'nanoX',
        rssi: -50,
        manufacturer: 'ledger',
    }) as HardwareWalletDevice

describe('useLedgerScanScreen', () => {
    beforeEach(() => {
        useLedgerPairingStore.getState().resetState()
        mockNavigate.mockReset()
        mockStartScan.mockReset()
        mockStopScan.mockReset()
    })

    it('navigates straight to fetch-accounts when device was previously paired', () => {
        useLedgerPairingStore.getState().markPaired('device-known')

        const { result } = renderHook(() => useLedgerScanScreen())
        act(() => {
            result.current.handleDevicePress(makeDevice('device-known'))
        })

        expect(mockNavigate).toHaveBeenCalledWith('LedgerFetchAccounts', {
            deviceId: 'device-known',
            deviceName: 'Fred Nano X',
        })
        expect(result.current.pendingPairingDevice).toBeNull()
    })

    it('shows pairing instructions for a never-seen device instead of navigating', () => {
        const { result } = renderHook(() => useLedgerScanScreen())
        act(() => {
            result.current.handleDevicePress(makeDevice('device-new'))
        })

        expect(mockNavigate).not.toHaveBeenCalled()
        expect(result.current.pendingPairingDevice?.id).toBe('device-new')
    })

    it('marks the device as paired and navigates on confirm', () => {
        const { result } = renderHook(() => useLedgerScanScreen())
        act(() => {
            result.current.handleDevicePress(makeDevice('device-new'))
        })
        act(() => {
            result.current.handleConfirmPairing()
        })

        expect(useLedgerPairingStore.getState().isPaired('device-new')).toBe(
            true,
        )
        expect(mockNavigate).toHaveBeenCalledWith('LedgerFetchAccounts', {
            deviceId: 'device-new',
            deviceName: 'Fred Nano X',
        })
        expect(result.current.pendingPairingDevice).toBeNull()
    })

    it('dismisses the sheet without marking paired or navigating on cancel', () => {
        const { result } = renderHook(() => useLedgerScanScreen())
        act(() => {
            result.current.handleDevicePress(makeDevice('device-new'))
        })
        act(() => {
            result.current.handleCancelPairing()
        })

        expect(useLedgerPairingStore.getState().isPaired('device-new')).toBe(
            false,
        )
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(result.current.pendingPairingDevice).toBeNull()
    })
})
