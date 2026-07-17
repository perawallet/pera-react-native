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

import { useEffect, useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type {
    HardwareWalletAdapterState,
    HardwareWalletDevice,
    LedgerTransportType,
} from '@perawallet/wallet-core-hardware-wallet'
import {
    LedgerLocationServicesDisabledError,
    LedgerScanTimeoutError,
} from '@perawallet/wallet-core-ledger'
import type { Nullable } from '@perawallet/wallet-core-shared'

import {
    useBlePermissions,
    useBluetoothState,
    useLedgerConnection,
} from '../../hooks'
import { sanitizeDeviceName } from '../../utils'

/**
 * Per-state copy for the Bluetooth warning toast, mirroring iOS's
 * `CBManagerState` → banner mapping on the device-list screen.
 */
const BLUETOOTH_TOAST_COPY: Partial<
    Record<HardwareWalletAdapterState, { titleKey: string; bodyKey: string }>
> = {
    poweredOff: {
        titleKey: 'ledger.scan.bluetooth.off_title',
        bodyKey: 'ledger.scan.bluetooth.off',
    },
    unauthorized: {
        titleKey: 'ledger.scan.bluetooth.unauthorized_title',
        bodyKey: 'ledger.scan.bluetooth.unauthorized',
    },
    unsupported: {
        titleKey: 'ledger.scan.bluetooth.unsupported_title',
        bodyKey: 'ledger.scan.bluetooth.unsupported',
    },
}

type UseLedgerScanScreenResult = {
    devices: HardwareWalletDevice[]
    error: Nullable<Error>
    isCheckingPermissions: boolean
    hasPermissions: boolean
    isPermissionDenied: boolean
    /**
     * True when re-requesting the permission can't help and the CTA should
     * hand off to OS Settings instead: Android NEVER_ASK_AGAIN, or iOS
     * Bluetooth denial (which has no runtime prompt at all).
     */
    shouldOpenSettings: boolean
    /**
     * True when the scan failed because the OS location toggle is off (Android
     * ≤ 11 needs it on for BLE discovery). Lets the screen render an
     * actionable "turn on Location" state instead of a generic retry.
     */
    isLocationServicesDisabled: boolean
    /**
     * True when the scan hit its budget with no device found. The screen
     * renders a distinct timed-out state with a working "Scan Again" instead
     * of a perpetual searching animation.
     */
    isScanTimeout: boolean
    handleDevicePress: (device: HardwareWalletDevice) => void
    handleRetry: () => void
    handleRequestPermissions: () => void
    handleOpenLocationSettings: () => void
    handleTroubleshoot: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

const USB_ONLY_TRANSPORTS: LedgerTransportType[] = ['usb']

export const useLedgerScanScreen = (): UseLedgerScanScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { errorToast } = useToast()
    const {
        hasPermissions,
        isChecking: isCheckingPermissions,
        isBlocked: isPermissionBlocked,
        requestPermissions,
        openSettings,
        openLocationSettings,
    } = useBlePermissions()
    const { adapterState, isBluetoothReady, requestEnable } =
        useBluetoothState()

    // iOS has no runtime BLE permission request (useBlePermissions reports
    // granted) — a denial surfaces as the adapter's `unauthorized` state and
    // only OS Settings can change it.
    const isIosBluetoothDenied =
        Platform.OS === 'ios' && adapterState === 'unauthorized'
    const canScanBle = hasPermissions && !isIosBluetoothDenied

    // USB HID needs no Bluetooth permission, so a denied BLE permission must
    // not block it: fall back to a USB-only scan when the platform supports
    // one.
    const { devices, startScan, stopScan, error, supportedTransportTypes } =
        useLedgerConnection(
            canScanBle ? undefined : { transportTypes: USB_ONLY_TRANSPORTS },
        )
    const isUsbFallbackScan =
        !canScanBle && supportedTransportTypes.includes('usb')

    const [hasRequestedPermissions, setHasRequestedPermissions] =
        useState(false)
    const lastWarnedStateRef =
        useRef<Nullable<HardwareWalletAdapterState>>(null)

    // Start scanning whenever a usable transport exists: BLE when permitted,
    // USB-only otherwise. On full denial with no USB fallback, the screen
    // surfaces an actionable state via `isPermissionDenied` instead of
    // silently rendering an empty device list.
    //
    // `isBluetoothReady` is a dependency so that toggling Bluetooth back on
    // re-runs this effect, restarting the scan through the proper
    // `stopScan` cleanup (the scan-timeout may have already torn it down).
    useEffect(() => {
        if (isCheckingPermissions) return
        if (!canScanBle && !isUsbFallbackScan) return

        startScan()
        return () => {
            stopScan()
        }
    }, [
        isCheckingPermissions,
        canScanBle,
        isUsbFallbackScan,
        startScan,
        stopScan,
        isBluetoothReady,
    ])

    // Request the Android BLE permission once when missing — independent of
    // the scan effect, so a USB fallback scan doesn't swallow the request.
    useEffect(() => {
        if (isCheckingPermissions || hasPermissions || hasRequestedPermissions)
            return
        setHasRequestedPermissions(true)
        void requestPermissions()
    }, [
        isCheckingPermissions,
        hasPermissions,
        hasRequestedPermissions,
        requestPermissions,
    ])

    // Proactively warn when the Bluetooth adapter is unusable. Unlike the
    // connect/verify screens — which pre-flight `isSupported()` and surface a
    // typed error — `TransportBLE.listen` silently waits for the radio to
    // power on, so a scan with Bluetooth off would otherwise leave the user on
    // a blank "Looking for devices" screen with no feedback.
    //
    // Mirrors iOS, which shows BOTH an in-app banner and the OS power alert:
    // we keep the red toast for every actionable state, and additionally
    // surface the OS "turn on Bluetooth" prompt when the radio is simply off
    // (not for unauthorized/unsupported, which the prompt can't resolve).
    // Both fire once per state transition.
    useEffect(() => {
        // Permission denial owns its own messaging; don't double up.
        if (isCheckingPermissions || !hasPermissions) return

        if (isBluetoothReady) {
            lastWarnedStateRef.current = 'poweredOn'
            return
        }

        const copy = BLUETOOTH_TOAST_COPY[adapterState]
        // Skip transient states (`unknown`, `resetting`) and avoid re-firing
        // the same warning while the state is unchanged.
        if (!copy || lastWarnedStateRef.current === adapterState) return

        lastWarnedStateRef.current = adapterState
        errorToast(t(copy.titleKey), t(copy.bodyKey))

        if (adapterState === 'poweredOff') {
            void requestEnable()
        }
    }, [
        adapterState,
        isBluetoothReady,
        hasPermissions,
        isCheckingPermissions,
        errorToast,
        requestEnable,
        t,
    ])

    const handleDevicePress = useCallback(
        (device: HardwareWalletDevice) => {
            stopScan()
            navigation.navigate('LedgerFetchAccounts', {
                deviceId: device.id,
                deviceName: sanitizeDeviceName(device.name),
                transportType: device.transportType,
            })
        },
        [navigation, stopScan],
    )

    const handleRetry = useCallback(() => {
        startScan()
    }, [startScan])

    const handleRequestPermissions = useCallback(() => {
        // After the OS marks the permission as NEVER_ASK_AGAIN the system
        // dialog won't reopen — hand the user off to Settings instead. iOS
        // Bluetooth denial can only ever be changed from Settings.
        if (isPermissionBlocked || isIosBluetoothDenied) {
            void openSettings()
            return
        }
        void requestPermissions()
    }, [
        isPermissionBlocked,
        isIosBluetoothDenied,
        openSettings,
        requestPermissions,
    ])

    const handleOpenLocationSettings = useCallback(() => {
        void openLocationSettings()
    }, [openLocationSettings])

    const handleTroubleshoot = useCallback(() => {
        navigation.navigate('LedgerTroubleshooting')
    }, [navigation])

    // The blocking denied state only renders when no scan can run at all —
    // a USB fallback scan keeps the device list usable while BLE is denied.
    const isBleDenied =
        (!isCheckingPermissions &&
            !hasPermissions &&
            hasRequestedPermissions) ||
        isIosBluetoothDenied
    const isPermissionDenied = isBleDenied && !isUsbFallbackScan

    // Location services are only a BLE-scan prerequisite on Android (≤ 11).
    // Prompting an iOS user to turn on Location would be wrong advice, so keep
    // this actionable state Android-scoped (the error can't originate on iOS
    // anyway — this is defensive).
    const isLocationServicesDisabled =
        Platform.OS === 'android' &&
        error instanceof LedgerLocationServicesDisabledError

    const isScanTimeout = error instanceof LedgerScanTimeoutError

    return {
        devices,
        error,
        isCheckingPermissions,
        hasPermissions,
        isPermissionDenied,
        shouldOpenSettings: isPermissionBlocked || isIosBluetoothDenied,
        isLocationServicesDisabled,
        isScanTimeout,
        handleDevicePress,
        handleRetry,
        handleRequestPermissions,
        handleOpenLocationSettings,
        handleTroubleshoot,
        t,
    }
}
