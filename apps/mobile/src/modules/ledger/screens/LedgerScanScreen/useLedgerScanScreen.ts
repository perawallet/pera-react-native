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

import { useEffect, useCallback, useRef, useState } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import type {
    HardwareWalletAdapterState,
    HardwareWalletDevice,
} from '@perawallet/wallet-core-hardware-wallet'
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
    isPermissionBlocked: boolean
    handleDevicePress: (device: HardwareWalletDevice) => void
    handleRetry: () => void
    handleRequestPermissions: () => void
    handleTroubleshoot: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerScanScreen = (): UseLedgerScanScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { errorToast } = useToast()
    const { devices, startScan, stopScan, error } = useLedgerConnection()
    const {
        hasPermissions,
        isChecking: isCheckingPermissions,
        isBlocked: isPermissionBlocked,
        requestPermissions,
        openSettings,
    } = useBlePermissions()
    const { adapterState, isBluetoothReady, requestEnable } =
        useBluetoothState()
    const [hasRequestedPermissions, setHasRequestedPermissions] =
        useState(false)
    const lastWarnedStateRef =
        useRef<Nullable<HardwareWalletAdapterState>>(null)

    // Gate the scan on Bluetooth permission. On Android, request once when
    // missing; on grant the effect re-runs and starts scanning. On denial,
    // surface an actionable state via `isPermissionDenied` instead of
    // silently rendering an empty device list.
    //
    // `isBluetoothReady` is a dependency so that toggling Bluetooth back on
    // re-runs this effect, restarting the scan through the proper
    // `stopScan` cleanup (the scan-timeout may have already torn it down).
    useEffect(() => {
        if (isCheckingPermissions) return

        if (hasPermissions) {
            startScan()
            return () => {
                stopScan()
            }
        }

        if (hasRequestedPermissions) return
        setHasRequestedPermissions(true)
        void requestPermissions()
    }, [
        isCheckingPermissions,
        hasPermissions,
        hasRequestedPermissions,
        requestPermissions,
        startScan,
        stopScan,
        isBluetoothReady,
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
        // dialog won't reopen — hand the user off to Settings instead.
        if (isPermissionBlocked) {
            void openSettings()
            return
        }
        void requestPermissions()
    }, [isPermissionBlocked, openSettings, requestPermissions])

    const handleTroubleshoot = useCallback(() => {
        navigation.navigate('LedgerTroubleshooting')
    }, [navigation])

    const isPermissionDenied =
        !isCheckingPermissions && !hasPermissions && hasRequestedPermissions

    return {
        devices,
        error,
        isCheckingPermissions,
        hasPermissions,
        isPermissionDenied,
        isPermissionBlocked,
        handleDevicePress,
        handleRetry,
        handleRequestPermissions,
        handleTroubleshoot,
        t,
    }
}
