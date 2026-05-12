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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'

const {
    mockNavigate,
    mockSetOptions,
    mockStartScan,
    mockStopScan,
    mockRequestPermissions,
    blePermissionsState,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockSetOptions: vi.fn(),
    mockStartScan: vi.fn(),
    mockStopScan: vi.fn(),
    mockRequestPermissions: vi.fn(),
    blePermissionsState: {
        hasPermissions: true,
        isChecking: false,
    },
}))

const DEVICE = {
    id: 'ble-1234',
    name: 'AE72',
    transportType: 'ble' as const,
}

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@react-navigation/native', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...actual,
        useNavigation: () => ({ setOptions: mockSetOptions }),
    }
})

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('../../../hooks', () => ({
    useLedgerConnection: () => ({
        devices: [DEVICE],
        isScanning: false,
        startScan: mockStartScan,
        stopScan: mockStopScan,
        error: null,
    }),
    useBlePermissions: () => ({
        hasPermissions: blePermissionsState.hasPermissions,
        isChecking: blePermissionsState.isChecking,
        requestPermissions: mockRequestPermissions,
    }),
}))

import { LedgerScanScreen } from '../LedgerScanScreen'

describe('LedgerScanScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        blePermissionsState.hasPermissions = true
        blePermissionsState.isChecking = false
        mockRequestPermissions.mockResolvedValue(true)
    })

    it('renders the title and description', () => {
        render(<LedgerScanScreen />)

        expect(screen.getByText('ledger.scan.title')).toBeTruthy()
        expect(screen.getByText('ledger.scan.description')).toBeTruthy()
    })

    it('renders the device list', () => {
        render(<LedgerScanScreen />)

        expect(screen.getByText('AE72')).toBeTruthy()
    })

    it('navigates to LedgerTroubleshooting when the header help button is pressed', () => {
        render(<LedgerScanScreen />)

        const lastCall = mockSetOptions.mock.calls.at(-1)?.[0]
        const headerRight = lastCall?.headerRight?.()
        render(headerRight as React.ReactElement)
        fireEvent.click(screen.getByTestId('ledger_scan_help_button'))

        expect(mockNavigate).toHaveBeenCalledWith('LedgerTroubleshooting')
    })

    it('renders a permission-denied state and re-requests on tap when BLE permission is missing', () => {
        blePermissionsState.hasPermissions = false
        blePermissionsState.isChecking = false

        render(<LedgerScanScreen />)

        expect(screen.getByTestId('ledger_scan_permission_denied')).toBeTruthy()
        // First request fires on mount; we want to assert the retry click also fires one.
        mockRequestPermissions.mockClear()

        fireEvent.click(
            screen.getByTestId('ledger_scan_grant_permission_button'),
        )

        expect(mockRequestPermissions).toHaveBeenCalledTimes(1)
    })
})
