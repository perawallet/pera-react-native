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
import { useAccountHoldingsInvalidator } from '@perawallet/wallet-core-accounts'
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    useChainCapability,
    useIsCapabilityRestricted,
} from '@perawallet/wallet-core-chain-shared'
import { useToggleAssetFavoriteMutation } from '@perawallet/wallet-core-assets'
import {
    PeraServiceUnavailableError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useErrorToast } from '@hooks/useErrorToast'

export const useAssetFavoriteButton = (
    assetId: string,
    isFavorite: Optional<boolean>,
    scope: ChainScope,
) => {
    const deviceId = useDeploymentDeviceID(deploymentOf(scope))
    const { invalidate: invalidateHoldings } = useAccountHoldingsInvalidator()
    const { showError } = useErrorToast()
    const hasFavorites = useChainCapability(scope.chainId, 'assetFavorites')
    // Off for the chain outright hides the control; off only because of the
    // chain's current network mode keeps it, to explain why.
    const isRestricted = useIsCapabilityRestricted(
        scope.chainId,
        'assetFavorites',
    )
    const {
        toggleAssetFavorite,
        isLoading,
        isUnavailableOnNetwork: isMutationUnavailable,
    } = useToggleAssetFavoriteMutation({
        scope,
        onLocalWrite: invalidateHoldings,
    })
    const isUnavailableOnNetwork = isMutationUnavailable || !hasFavorites
    const isVisible = !isUnavailableOnNetwork || isRestricted

    const handleToggleFavorite = useCallback(() => {
        // Stays reachable (not truly disabled) so the tap can explain why,
        // instead of the press being silently swallowed.
        if (isUnavailableOnNetwork) {
            showError(new PeraServiceUnavailableError(scope))
            return
        }
        if (deviceId && isFavorite !== undefined) {
            toggleAssetFavorite({
                assetID: assetId,
                deviceId: `${deviceId}`,
                enabled: !isFavorite,
            })
        }
    }, [
        assetId,
        deviceId,
        isFavorite,
        toggleAssetFavorite,
        scope,
        isUnavailableOnNetwork,
        showError,
    ])

    return {
        handleToggleFavorite,
        isVisible,
        isDisabled: !deviceId || isFavorite === undefined || isLoading,
        isUnavailableOnNetwork,
    }
}
