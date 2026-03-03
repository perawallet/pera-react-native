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

import { useCallback } from 'react'
import { useDeviceID } from '@perawallet/wallet-extension-platform'
import { useNetwork } from '@perawallet/wallet-extension-network'
import { useToggleAssetPriceAlertMutation } from '@perawallet/wallet-core-assets'

export const useAssetNotificationButton = (
    assetId: string,
    isNotificationsEnabled: boolean | undefined,
) => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const { toggleAssetPriceAlert, isLoading } =
        useToggleAssetPriceAlertMutation()

    const handleToggleNotifications = useCallback(() => {
        if (deviceId && isNotificationsEnabled !== undefined) {
            toggleAssetPriceAlert({
                assetID: assetId,
                deviceId: `${deviceId}`,
                enabled: !isNotificationsEnabled,
                network,
            })
        }
    }, [
        assetId,
        deviceId,
        isNotificationsEnabled,
        toggleAssetPriceAlert,
        network,
    ])

    return {
        handleToggleNotifications,
        isDisabled:
            !deviceId || isNotificationsEnabled === undefined || isLoading,
    }
}
