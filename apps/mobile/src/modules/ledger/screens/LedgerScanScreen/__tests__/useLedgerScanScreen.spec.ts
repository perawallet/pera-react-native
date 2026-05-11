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

const { mockNavigate, mockStartScan, mockStopScan } = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockStartScan: vi.fn(),
    mockStopScan: vi.fn(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../hooks', () => ({
    useLedgerConnection: () => ({
        devices: [],
        isScanning: true,
        startScan: mockStartScan,
        stopScan: mockStopScan,
        error: null,
    }),
}))

import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

import { useLedgerScanScreen } from '../useLedgerScanScreen'

const DEVICE: HardwareWalletDevice = {
    id: 'ble-1234',
    name: 'AE72',
    transportType: 'ble',
    manufacturer: 'ledger',
    model: 'nanoX',
    rssi: -50,
}

describe('useLedgerScanScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
            setTimeout(cb, 0),
        )
    })

    it('starts scanning on mount and stops on unmount', () => {
        const { unmount } = renderHook(() => useLedgerScanScreen())

        expect(mockStartScan).toHaveBeenCalled()

        unmount()

        expect(mockStopScan).toHaveBeenCalled()
    })

    it('sets connectingDevice and navigates when a device is tapped', () => {
        const { result } = renderHook(() => useLedgerScanScreen())

        act(() => {
            result.current.handleDevicePress(DEVICE)
        })

        expect(result.current.connectingDevice).toEqual(DEVICE)

        act(() => {
            vi.runOnlyPendingTimers()
        })

        expect(mockStopScan).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('LedgerFetchAccounts', {
            deviceId: DEVICE.id,
            deviceName: DEVICE.name,
            transportType: DEVICE.transportType,
        })
    })

    it('aborts navigation when cancel is pressed before the rAF fires', () => {
        const { result } = renderHook(() => useLedgerScanScreen())

        act(() => {
            result.current.handleDevicePress(DEVICE)
        })
        act(() => {
            result.current.handleCancelConnecting()
        })
        act(() => {
            vi.runOnlyPendingTimers()
        })

        expect(result.current.connectingDevice).toBeNull()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('navigates to troubleshooting on handleTroubleshoot', () => {
        const { result } = renderHook(() => useLedgerScanScreen())

        act(() => {
            result.current.handleTroubleshoot()
        })

        expect(mockNavigate).toHaveBeenCalledWith('LedgerTroubleshooting')
    })
})
