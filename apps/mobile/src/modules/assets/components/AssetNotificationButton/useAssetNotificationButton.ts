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

import { useCallback } from 'react'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useToggleAssetPriceAlertMutation } from '@perawallet/wallet-core-assets'
import {
    PeraServiceUnavailableError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useErrorToast } from '@hooks/useErrorToast'

export const useAssetNotificationButton = (
    assetId: string,
    isNotificationsEnabled: Optional<boolean>,
) => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const { showError } = useErrorToast()
    const { toggleAssetPriceAlert, isLoading, isUnavailableOnNetwork } =
        useToggleAssetPriceAlertMutation()

    const handleToggleNotifications = useCallback(() => {
        // Stays reachable (not truly disabled) so the tap can explain why,
        // instead of the press being silently swallowed.
        if (isUnavailableOnNetwork) {
            showError(new PeraServiceUnavailableError(network))
            return
        }
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
        isUnavailableOnNetwork,
        showError,
    ])

    return {
        handleToggleNotifications,
        isDisabled:
            !deviceId || isNotificationsEnabled === undefined || isLoading,
        isUnavailableOnNetwork,
    }
}
