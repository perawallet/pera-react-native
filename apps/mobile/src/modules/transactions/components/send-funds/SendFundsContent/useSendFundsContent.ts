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

import { useCallback, useLayoutEffect } from 'react'
import { Decimal } from 'decimal.js'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import {
    isCollectible,
    isPureNft,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useSendFunds } from '@modules/transactions/hooks'

type UseSendFundsContentResult = {
    selectedAccount: ReturnType<typeof useSelectedAccount>
    handleFinished: () => void
}

export const useSendFundsContent = (
    assetId: Optional<string>,
): UseSendFundsContentResult => {
    const selectedAccount = useSelectedAccount()
    const {
        canSelectAsset,
        selectedAssetId,
        setSelectedAssetId,
        setCanSelectAsset,
        setAmount,
        setOnFinished,
        reset,
    } = useSendFunds()
    const { dismiss } = useBottomSheetResult<void>()

    const { data: assets } = useAssetsQuery(assetId ? [assetId] : [])
    const asset = assetId ? assets.get(assetId) : undefined

    useLayoutEffect(() => {
        if (assetId != null) {
            if (canSelectAsset) {
                setCanSelectAsset(false)
            }

            if (selectedAssetId !== assetId) {
                setSelectedAssetId(assetId)
            }

            // Pure collectibles have a fixed quantity of 1, so prefill
            // the amount and skip the input screen entirely.
            if (asset && isCollectible(asset) && isPureNft(asset)) {
                setAmount(new Decimal(1))
            }
        }
    }, [
        assetId,
        asset,
        setCanSelectAsset,
        setSelectedAssetId,
        setAmount,
        canSelectAsset,
        selectedAssetId,
    ])

    const handleFinished = useCallback(() => {
        reset()
        dismiss()
    }, [reset, dismiss])

    useLayoutEffect(() => {
        setOnFinished(handleFinished)
    }, [handleFinished, setOnFinished])

    return {
        selectedAccount,
        handleFinished,
    }
}
