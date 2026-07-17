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

const {
    mockNavigate,
    mockStartScan,
    mockStopScan,
    mockRequestPermissions,
    mockOpenSettings,
    mockOpenLocationSettings,
    mockErrorToast,
    mockRequestEnable,
    blePermissionsState,
    bluetoothState,
    connectionState,
    platformState,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockStartScan: vi.fn(),
    mockStopScan: vi.fn(),
    mockRequestPermissions: vi.fn(),
    mockOpenSettings: vi.fn(),
    mockOpenLocationSettings: vi.fn(),
    mockErrorToast: vi.fn(),
    mockRequestEnable: vi.fn(),
    blePermissionsState: {
        hasPermissions: true,
        isChecking: false,
        isBlocked: false,
    },
    bluetoothState: {
        adapterState: 'poweredOn' as
            | 'poweredOn'
            | 'poweredOff'
            | 'unauthorized'
            | 'unsupported'
            | 'resetting'
            | 'unknown',
    },
    connectionState: {
        error: null as Error | null,
        supportedTransportTypes: ['ble'] as Array<'ble' | 'usb'>,
        capturedOptions: undefined as unknown,
    },
    platformState: { os: 'android' as 'android' | 'ios' },
}))

vi.mock('react-native', () => ({
    Platform: {
        get OS() {
            return platformState.os
        },
    },
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))

vi.mock('../../../hooks', () => ({
    useLedgerConnection: (options?: unknown) => {
        connectionState.capturedOptions = options
        return {
            devices: [],
            isScanning: true,
            startScan: mockStartScan,
            stopScan: mockStopScan,
            error: connectionState.error,
            supportedTransportTypes: connectionState.supportedTransportTypes,
            isReady: true,
        }
    },
    useBlePermissions: () => ({
        hasPermissions: blePermissionsState.hasPermissions,
        isChecking: blePermissionsState.isChecking,
        isBlocked: blePermissionsState.isBlocked,
        requestPermissions: mockRequestPermissions,
        openSettings: mockOpenSettings,
        openLocationSettings: mockOpenLocationSettings,
    }),
    useBluetoothState: () => ({
        adapterState: bluetoothState.adapterState,
        isBluetoothReady: bluetoothState.adapterState === 'poweredOn',
        isBluetoothUnavailable: [
            'poweredOff',
            'unauthorized',
            'unsupported',
        ].includes(bluetoothState.adapterState),
        requestEnable: mockRequestEnable,
    }),
}))

import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'
import {
    LedgerConnectionError,
    LedgerLocationServicesDisabledError,
    LedgerScanTimeoutError,
} from '@perawallet/wallet-core-ledger'

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
        blePermissionsState.hasPermissions = true
        blePermissionsState.isChecking = false
        blePermissionsState.isBlocked = false
        bluetoothState.adapterState = 'poweredOn'
        connectionState.error = null
        connectionState.supportedTransportTypes = ['ble']
        connectionState.capturedOptions = undefined
        platformState.os = 'android'
        mockRequestPermissions.mockResolvedValue(true)
        mockOpenSettings.mockResolvedValue(undefined)
        mockOpenLocationSettings.mockResolvedValue(undefined)
    })

    it('starts scanning on mount and stops on unmount when permissions are granted', () => {
        const { unmount } = renderHook(() => useLedgerScanScreen())

        expect(mockStartScan).toHaveBeenCalled()

        unmount()

        expect(mockStopScan).toHaveBeenCalled()
    })

    it('does not start scanning while the permission check is in flight', () => {
        blePermissionsState.hasPermissions = false
        blePermissionsState.isChecking = true

        renderHook(() => useLedgerScanScreen())

        expect(mockStartScan).not.toHaveBeenCalled()
        expect(mockRequestPermissions).not.toHaveBeenCalled()
    })

    it('requests permissions on mount when missing and does not start scanning', () => {
        blePermissionsState.hasPermissions = false
        blePermissionsState.isChecking = false

        renderHook(() => useLedgerScanScreen())

        expect(mockRequestPermissions).toHaveBeenCalledTimes(1)
        expect(mockStartScan).not.toHaveBeenCalled()
    })

    it('surfaces isPermissionDenied once a request has been made and permission is still missing', () => {
        blePermissionsState.hasPermissions = false
        blePermissionsState.isChecking = false

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(result.current.isPermissionDenied).toBe(true)
    })

    it('does not surface isPermissionDenied while the check is in flight', () => {
        blePermissionsState.hasPermissions = false
        blePermissionsState.isChecking = true

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(result.current.isPermissionDenied).toBe(false)
    })

    it('lets the user retry the permission request via handleRequestPermissions', () => {
        blePermissionsState.hasPermissions = false
        blePermissionsState.isChecking = false

        const { result } = renderHook(() => useLedgerScanScreen())
        mockRequestPermissions.mockClear()

        act(() => {
            result.current.handleRequestPermissions()
        })

        expect(mockRequestPermissions).toHaveBeenCalledTimes(1)
        expect(mockOpenSettings).not.toHaveBeenCalled()
    })

    it('hands the user off to Settings when permission is OS-blocked', () => {
        blePermissionsState.hasPermissions = false
        blePermissionsState.isChecking = false
        blePermissionsState.isBlocked = true

        const { result } = renderHook(() => useLedgerScanScreen())
        mockRequestPermissions.mockClear()

        act(() => {
            result.current.handleRequestPermissions()
        })

        expect(mockOpenSettings).toHaveBeenCalledTimes(1)
        expect(mockRequestPermissions).not.toHaveBeenCalled()
        expect(result.current.shouldOpenSettings).toBe(true)
    })

    it('stops scanning and navigates when a device is tapped', () => {
        const { result } = renderHook(() => useLedgerScanScreen())

        act(() => {
            result.current.handleDevicePress(DEVICE)
        })

        expect(mockStopScan).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('LedgerFetchAccounts', {
            deviceId: DEVICE.id,
            deviceName: DEVICE.name,
            transportType: DEVICE.transportType,
        })
    })

    it('sanitizes the device name before forwarding to navigation params', () => {
        const { result } = renderHook(() => useLedgerScanScreen())
        const hostileDevice: HardwareWalletDevice = {
            ...DEVICE,
            // RLO override + leading control char — must not reach the nav header.
            name: 'Ledger ‮X9F2A',
        }

        act(() => {
            result.current.handleDevicePress(hostileDevice)
        })

        expect(mockNavigate).toHaveBeenCalledWith('LedgerFetchAccounts', {
            deviceId: hostileDevice.id,
            deviceName: 'Ledger X9F2A',
            transportType: hostileDevice.transportType,
        })
    })

    it('navigates to troubleshooting on handleTroubleshoot', () => {
        const { result } = renderHook(() => useLedgerScanScreen())

        act(() => {
            result.current.handleTroubleshoot()
        })

        expect(mockNavigate).toHaveBeenCalledWith('LedgerTroubleshooting')
    })

    it('shows a Bluetooth-off error toast when the adapter is powered off', () => {
        bluetoothState.adapterState = 'poweredOff'

        renderHook(() => useLedgerScanScreen())

        expect(mockErrorToast).toHaveBeenCalledWith(
            'ledger.scan.bluetooth.off_title',
            'ledger.scan.bluetooth.off',
        )
    })

    it('uses the unauthorized copy when Bluetooth permission is denied at the adapter', () => {
        bluetoothState.adapterState = 'unauthorized'

        renderHook(() => useLedgerScanScreen())

        expect(mockErrorToast).toHaveBeenCalledWith(
            'ledger.scan.bluetooth.unauthorized_title',
            'ledger.scan.bluetooth.unauthorized',
        )
    })

    it('surfaces the OS enable prompt when Bluetooth is powered off', () => {
        bluetoothState.adapterState = 'poweredOff'

        renderHook(() => useLedgerScanScreen())

        expect(mockRequestEnable).toHaveBeenCalledTimes(1)
    })

    it('does not surface the OS enable prompt for unauthorized or unsupported', () => {
        bluetoothState.adapterState = 'unauthorized'

        renderHook(() => useLedgerScanScreen())

        // The OS "turn on Bluetooth" prompt can't resolve a permission or
        // hardware problem — only the toast should show.
        expect(mockRequestEnable).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalled()
    })

    it('does not warn for transient adapter states', () => {
        bluetoothState.adapterState = 'unknown'

        renderHook(() => useLedgerScanScreen())

        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('does not warn when Bluetooth is powered on', () => {
        bluetoothState.adapterState = 'poweredOn'

        renderHook(() => useLedgerScanScreen())

        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('restarts the scan when Bluetooth recovers from off to on', () => {
        bluetoothState.adapterState = 'poweredOff'
        const { rerender } = renderHook(() => useLedgerScanScreen())

        mockStartScan.mockClear()
        mockStopScan.mockClear()

        bluetoothState.adapterState = 'poweredOn'
        act(() => {
            rerender()
        })

        // The main scan effect re-runs on readiness change: stop the
        // (timed-out) scan, then start fresh.
        expect(mockStopScan).toHaveBeenCalled()
        expect(mockStartScan).toHaveBeenCalled()
    })

    it('flags isLocationServicesDisabled for a location-services scan error', () => {
        connectionState.error = new LedgerLocationServicesDisabledError()

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(result.current.isLocationServicesDisabled).toBe(true)
    })

    it('does not flag isLocationServicesDisabled for other scan errors', () => {
        connectionState.error = new LedgerConnectionError('generic ble failure')

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(result.current.isLocationServicesDisabled).toBe(false)
    })

    it('never flags isLocationServicesDisabled on iOS (Android-only copy)', () => {
        platformState.os = 'ios'
        connectionState.error = new LedgerLocationServicesDisabledError()

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(result.current.isLocationServicesDisabled).toBe(false)
    })

    it('delegates handleOpenLocationSettings to the permissions hook', () => {
        const { result } = renderHook(() => useLedgerScanScreen())

        act(() => {
            result.current.handleOpenLocationSettings()
        })

        expect(mockOpenLocationSettings).toHaveBeenCalledTimes(1)
    })

    it('flags isScanTimeout for a scan-timeout error', () => {
        connectionState.error = new LedgerScanTimeoutError('no device found')

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(result.current.isScanTimeout).toBe(true)
    })

    it('does not flag isScanTimeout for other scan errors', () => {
        connectionState.error = new LedgerConnectionError('generic ble failure')

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(result.current.isScanTimeout).toBe(false)
    })

    it('starts a USB-only scan when BLE permission is denied but USB is supported', () => {
        // USB HID needs no Bluetooth permission — denying BLE must not block
        // the USB fallback the transport was pitched as.
        blePermissionsState.hasPermissions = false
        connectionState.supportedTransportTypes = ['ble', 'usb']

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(mockStartScan).toHaveBeenCalled()
        expect(connectionState.capturedOptions).toEqual({
            transportTypes: ['usb'],
        })
        // The full-screen denied state must not block the USB device list;
        // the BLE permission request still fires once.
        expect(result.current.isPermissionDenied).toBe(false)
        expect(mockRequestPermissions).toHaveBeenCalled()
    })

    it('keeps the blocking denied state when BLE is denied and USB is unavailable', () => {
        blePermissionsState.hasPermissions = false
        connectionState.supportedTransportTypes = ['ble']

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(mockStartScan).not.toHaveBeenCalled()
        expect(result.current.isPermissionDenied).toBe(true)
    })

    it('surfaces a persistent denied state with a Settings handoff for iOS Bluetooth denial', () => {
        // iOS has no runtime BLE permission request — denial surfaces as the
        // adapter's `unauthorized` state and only OS Settings can fix it.
        platformState.os = 'ios'
        bluetoothState.adapterState = 'unauthorized'

        const { result } = renderHook(() => useLedgerScanScreen())

        expect(result.current.isPermissionDenied).toBe(true)
        expect(result.current.shouldOpenSettings).toBe(true)
        expect(mockStartScan).not.toHaveBeenCalled()

        act(() => {
            result.current.handleRequestPermissions()
        })
        expect(mockOpenSettings).toHaveBeenCalledTimes(1)
    })
})
