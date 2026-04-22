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

import { useLedgerConnection } from '../../hooks'
import { useLedgerPairedDevicesStore } from '../../hooks/useLedgerPairedDevicesStore'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseLedgerScanScreenResult = {
    devices: HardwareWalletDevice[]
    isScanning: boolean
    error: Nullable<Error>
    /** Device awaiting pairing-instructions confirmation, if any. */
    pendingPairingDevice: Nullable<HardwareWalletDevice>
    handleDevicePress: (device: HardwareWalletDevice) => void
    /** Confirm the pairing instructions and proceed with the connection. */
    handleConfirmPairing: () => void
    /** Dismiss the pairing instructions without connecting. */
    handleCancelPairing: () => void
    handleRetry: () => void
    handleTroubleshoot: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerScanScreen = (): UseLedgerScanScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { devices, isScanning, startScan, stopScan, error } =
        useLedgerConnection()

    const isPaired = useLedgerPairedDevicesStore(state => state.isPaired)
    const markPaired = useLedgerPairedDevicesStore(state => state.markPaired)

    const [pendingPairingDevice, setPendingPairingDevice] =
        useState<Nullable<HardwareWalletDevice>>(null)

    useEffect(() => {
        startScan()

        return () => {
            stopScan()
        }
    }, [startScan, stopScan])

    const proceedWithDevice = useCallback(
        (device: HardwareWalletDevice) => {
            stopScan()
            navigation.navigate('LedgerFetchAccounts', {
                deviceId: device.id,
                deviceName: device.name,
            })
        },
        [stopScan, navigation],
    )

    const handleDevicePress = useCallback(
        (device: HardwareWalletDevice) => {
            // Skip the pairing-instructions sheet for devices the user has
            // already paired with. Portable analog to Android's
            // BluetoothAdapter.bondedDevices check — iOS has no equivalent
            // API, so we record success at the app level (see
            // useLedgerPairedDevicesStore).
            if (isPaired(device.id)) {
                proceedWithDevice(device)
                return
            }
            setPendingPairingDevice(device)
        },
        [isPaired, proceedWithDevice],
    )

    const handleConfirmPairing = useCallback(() => {
        if (!pendingPairingDevice) return
        markPaired(pendingPairingDevice.id)
        const device = pendingPairingDevice
        setPendingPairingDevice(null)
        proceedWithDevice(device)
    }, [pendingPairingDevice, markPaired, proceedWithDevice])

    const handleCancelPairing = useCallback(() => {
        setPendingPairingDevice(null)
    }, [])

    const handleRetry = useCallback(() => {
        startScan()
    }, [startScan])

    const handleTroubleshoot = useCallback(() => {
        navigation.navigate('LedgerTroubleshooting')
    }, [navigation])

    return {
        devices,
        isScanning,
        error,
        pendingPairingDevice,
        handleDevicePress,
        handleConfirmPairing,
        handleCancelPairing,
        handleRetry,
        handleTroubleshoot,
        t,
    }
}
