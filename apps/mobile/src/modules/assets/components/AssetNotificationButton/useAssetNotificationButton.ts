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
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useChainCapability,
    useIsCapabilityRestricted,
} from '@perawallet/wallet-core-chain-shared'
import { useToggleAssetPriceAlertMutation } from '@perawallet/wallet-core-assets'
import {
    PeraServiceUnavailableError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useErrorToast } from '@hooks/useErrorToast'

export const useAssetNotificationButton = (
    assetId: string,
    isNotificationsEnabled: Optional<boolean>,
    scope: ChainScope,
) => {
    const deviceId = useDeploymentDeviceID(deploymentOf(scope))
    const { showError } = useErrorToast()
    const hasPriceAlerts = useChainCapability(scope.chainId, 'priceAlerts')
    // Off for the chain outright hides the control; off only because of the
    // chain's current network mode keeps it, to explain why.
    const isRestricted = useIsCapabilityRestricted(scope.chainId, 'priceAlerts')
    const {
        toggleAssetPriceAlert,
        isLoading,
        isUnavailableOnNetwork: isMutationUnavailable,
    } = useToggleAssetPriceAlertMutation({ scope })
    const isUnavailableOnNetwork = isMutationUnavailable || !hasPriceAlerts
    const isVisible = !isUnavailableOnNetwork || isRestricted

    const handleToggleNotifications = useCallback(() => {
        // Stays reachable (not truly disabled) so the tap can explain why,
        // instead of the press being silently swallowed.
        if (isUnavailableOnNetwork) {
            showError(new PeraServiceUnavailableError(scope))
            return
        }
        if (deviceId && isNotificationsEnabled !== undefined) {
            toggleAssetPriceAlert({
                assetID: assetId,
                deviceId: `${deviceId}`,
                enabled: !isNotificationsEnabled,
            })
        }
    }, [
        assetId,
        deviceId,
        isNotificationsEnabled,
        toggleAssetPriceAlert,
        scope,
        isUnavailableOnNetwork,
        showError,
    ])

    return {
        handleToggleNotifications,
        isVisible,
        isDisabled:
            !deviceId || isNotificationsEnabled === undefined || isLoading,
        isUnavailableOnNetwork,
    }
}
