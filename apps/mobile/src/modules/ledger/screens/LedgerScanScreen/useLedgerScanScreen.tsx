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
import {
    useLedgerPairing,
    useLedgerPairingStore,
} from '@perawallet/wallet-core-ledger'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { LedgerPairingInstructionsContent } from '../../components/LedgerPairingInstructionsContent'

import { useLedgerConnection } from '../../hooks'

type UseLedgerScanScreenResult = {
    devices: HardwareWalletDevice[]
    isScanning: boolean
    error: Nullable<Error>
    handleDevicePress: (device: HardwareWalletDevice) => Promise<void>
    handleRetry: () => void
    handleTroubleshoot: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerScanScreen = (): UseLedgerScanScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { devices, isScanning, startScan, stopScan, error } =
        useLedgerConnection()
    const { requestPairing, confirmPairing, cancelPairing } = useLedgerPairing()
    const { request: requestBottomSheet } = useBottomSheet()

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
                transportType: device.transportType,
            })
        },
        [stopScan, navigation],
    )

    const handleDevicePress = useCallback(
        async (device: HardwareWalletDevice) => {
            // `requestPairing` auto-callbacks for already-paired or USB
            // devices and only parks a pending device when the pairing
            // instructions sheet is needed — so we only open the sheet
            // when the store actually transitioned to a pending state.
            requestPairing(device, proceedWithDevice)

            const isPending =
                useLedgerPairingStore.getState().pendingPairingDevice !== null
            if (!isPending) return

            const confirmed = await requestBottomSheet<boolean>({
                contents: <LedgerPairingInstructionsContent />,
                options: { size: 'auto', enablePanDownToClose: true },
            })

            if (confirmed) {
                confirmPairing(proceedWithDevice)
            } else {
                cancelPairing()
            }
        },
        [
            requestPairing,
            confirmPairing,
            cancelPairing,
            proceedWithDevice,
            requestBottomSheet,
        ],
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
