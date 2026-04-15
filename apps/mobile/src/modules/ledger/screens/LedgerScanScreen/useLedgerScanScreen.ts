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

import { useEffect, useCallback } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import type { HardwareWalletDevice } from '@perawallet/wallet-core-hardware-wallet'

import { useLedgerConnection } from '../../hooks'

type UseLedgerScanScreenResult = {
    devices: HardwareWalletDevice[]
    isScanning: boolean
    error: Error | null
    handleDevicePress: (device: HardwareWalletDevice) => void
    handleRetry: () => void
    handleTroubleshoot: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerScanScreen = (): UseLedgerScanScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { devices, isScanning, startScan, stopScan, error } =
        useLedgerConnection()

    useEffect(() => {
        startScan()

        return () => {
            stopScan()
        }
    }, [startScan, stopScan])

    const handleDevicePress = useCallback(
        (device: HardwareWalletDevice) => {
            stopScan()
            navigation.navigate('LedgerFetchAccounts', {
                deviceId: device.id,
                deviceName: device.name,
            })
        },
        [stopScan, navigation],
    )

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
        handleDevicePress,
        handleRetry,
        handleTroubleshoot,
        t,
    }
}
