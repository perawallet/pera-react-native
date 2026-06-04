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
import {
    useDistinctPairsHistoryQuery,
    useSwaps,
    type SwapDistinctPairItem,
} from '@perawallet/wallet-core-swaps'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { useBottomSheet } from '@modules/bottom-sheet'
import { SwapHistoryContent } from '@modules/swap/components/SwapHistoryContent'

import { VISIBLE_SWAP_STATUSES } from '../../constants'

export type UseSwapPairHistoryWidgetResult = {
    pairs: SwapDistinctPairItem[]
    isLoading: boolean
    isError: boolean
    isEnabled: boolean
    address: string
    handlePairPress: (pair: SwapDistinctPairItem) => void
    handleSeeAllPress: () => void
}

export const useSwapPairHistoryWidget = (): UseSwapPairHistoryWidgetResult => {
    const selectedAccount = useSelectedAccount()
    const { setFromAsset, setToAsset } = useSwaps()
    const address = selectedAccount?.address ?? ''
    const { request: requestBottomSheet } = useBottomSheet()

    const { data, isLoading, isError } = useDistinctPairsHistoryQuery(
        address,
        VISIBLE_SWAP_STATUSES,
        address.length > 0,
    )

    const handlePairPress = useCallback(
        (pair: SwapDistinctPairItem) => {
            setFromAsset(String(pair.assetIn.assetId))
            setToAsset(String(pair.assetOut.assetId))
        },
        [setFromAsset, setToAsset],
    )

    const handleSeeAllPress = useCallback(() => {
        if (!address) return
        void requestBottomSheet<void>({
            contents: <SwapHistoryContent address={address} />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [address, requestBottomSheet])

    return {
        pairs: data ?? [],
        isLoading,
        isError,
        isEnabled: address.length > 0,
        address,
        handlePairPress,
        handleSeeAllPress,
    }
}
