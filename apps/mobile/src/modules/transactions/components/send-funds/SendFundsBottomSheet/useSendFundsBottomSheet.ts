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
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'

type UseSendFundsBottomSheetResult = {
    selectedAccount: ReturnType<typeof useSelectedAccount>
}

export const useSendFundsBottomSheet = (
    isVisible: boolean,
    assetId: string | undefined,
    onClose: () => void,
): UseSendFundsBottomSheetResult => {
    const selectedAccount = useSelectedAccount()
    const {
        canSelectAsset,
        selectedAssetId,
        setSelectedAssetId,
        setCanSelectAsset,
        setOnFinished,
        reset,
    } = useSendFunds()

    useLayoutEffect(() => {
        if (isVisible && assetId != null) {
            if (canSelectAsset) {
                setCanSelectAsset(false)
            }

            if (selectedAssetId !== assetId) {
                setSelectedAssetId(assetId)
            }
        }
    }, [
        isVisible,
        assetId,
        setCanSelectAsset,
        setSelectedAssetId,
        canSelectAsset,
        selectedAssetId,
    ])

    const handleFinished = useCallback(() => {
        reset()
        onClose()
    }, [reset, onClose])

    useLayoutEffect(() => {
        if (isVisible) {
            setOnFinished(handleFinished)
        }
    }, [isVisible, handleFinished, setOnFinished])

    return {
        selectedAccount,
    }
}
