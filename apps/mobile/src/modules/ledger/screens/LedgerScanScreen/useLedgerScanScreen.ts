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

import { useEffect, useCallback, useState } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'
import type { Nullable } from '@perawallet/wallet-core-shared'

import { useBlePermissions, useLedgerConnection } from '../../hooks'
import { sanitizeDeviceName } from '../../utils'

type UseLedgerScanScreenResult = {
    devices: HardwareWalletDevice[]
    error: Nullable<Error>
    isCheckingPermissions: boolean
    hasPermissions: boolean
    isPermissionDenied: boolean
    handleDevicePress: (device: HardwareWalletDevice) => void
    handleRetry: () => void
    handleRequestPermissions: () => void
    handleTroubleshoot: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerScanScreen = (): UseLedgerScanScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { devices, startScan, stopScan, error } = useLedgerConnection()
    const {
        hasPermissions,
        isChecking: isCheckingPermissions,
        requestPermissions,
    } = useBlePermissions()
    const [hasRequestedPermissions, setHasRequestedPermissions] =
        useState(false)

    // Gate the scan on Bluetooth permission. On Android, request once when
    // missing; on grant the effect re-runs and starts scanning. On denial,
    // surface an actionable state via `isPermissionDenied` instead of
    // silently rendering an empty device list.
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
        requestPermissions()
    }, [
        isCheckingPermissions,
        hasPermissions,
        hasRequestedPermissions,
        requestPermissions,
        startScan,
        stopScan,
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
        requestPermissions()
    }, [requestPermissions])

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
        handleDevicePress,
        handleRetry,
        handleRequestPermissions,
        handleTroubleshoot,
        t,
    }
}
