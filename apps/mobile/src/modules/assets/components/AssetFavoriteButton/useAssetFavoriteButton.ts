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
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useToggleAssetFavoriteMutation } from '@perawallet/wallet-core-assets'
import { type Optional } from '@perawallet/wallet-core-shared'

export const useAssetFavoriteButton = (
    assetId: string,
    isFavorite: Optional<boolean>,
) => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network)
    const { invalidate: invalidateHoldings } = useAccountHoldingsInvalidator()
    const { toggleAssetFavorite, isLoading } = useToggleAssetFavoriteMutation({
        onLocalWrite: invalidateHoldings,
    })

    const handleToggleFavorite = useCallback(() => {
        if (deviceId && isFavorite !== undefined) {
            toggleAssetFavorite({
                assetID: assetId,
                deviceId: `${deviceId}`,
                enabled: !isFavorite,
                network,
            })
        }
    }, [assetId, deviceId, isFavorite, toggleAssetFavorite, network])

    return {
        handleToggleFavorite,
        isDisabled: !deviceId || isFavorite === undefined || isLoading,
    }
}
