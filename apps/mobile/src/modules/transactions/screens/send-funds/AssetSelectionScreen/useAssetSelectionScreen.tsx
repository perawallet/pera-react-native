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
import { Decimal } from 'decimal.js'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import {
    useSelectedAccount,
    type ChainAssetBalance,
} from '@perawallet/wallet-core-accounts'
import { isUniqueCollectible } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { useCapability } from '@hooks/useCapability'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    useReceiveFunds,
    useSendFunds,
    useSendScope,
} from '@modules/transactions/hooks'
import { ReceiveFundsContent } from '@modules/transactions/components/receive-funds/ReceiveFundsContent'
import type { SendFundsStackParamList } from '@modules/transactions/routes/send-funds/types'

export type UseAssetSelectionScreenResult = {
    chainId: ChainId
    networkName: string
    canReceive: boolean
    handleAssetSelected: (item: ChainAssetBalance) => void
    handleReceive: () => void
}

export const useAssetSelectionScreen = (): UseAssetSelectionScreenResult => {
    const { chainId } = useSendScope()
    const account = useSelectedAccount()
    const { setSelectedAsset, setAmount, onFinished } = useSendFunds()
    const {
        setCanSelectAccount,
        setSelectedAccount,
        setChainId: setReceiveChainId,
    } = useReceiveFunds()
    const { request: requestBottomSheet } = useBottomSheet()
    const canReceive = useCapability({
        chain: { chainId, capability: 'receive' },
    })
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()

    const handleAssetSelected = useCallback(
        (item: ChainAssetBalance) => {
            setSelectedAsset({
                chainId: item.scope.chainId,
                assetId: item.assetId,
            })
            // Unique collectibles have a fixed quantity of 1, so prefill
            // the amount and skip straight to picking a destination.
            if (item.asset && isUniqueCollectible(item.asset)) {
                setAmount(new Decimal(1))
                navigation.navigate('SelectDestination')
                return
            }
            navigation.navigate('InputAmount')
        },
        [navigation, setSelectedAsset, setAmount],
    )

    const handleReceive = useCallback(() => {
        onFinished?.()
        // The sheet picks its first screen on its first render, before its own effects can write the store.
        if (account) {
            setCanSelectAccount(false)
            setSelectedAccount(account)
        }
        setReceiveChainId(chainId)
        void requestBottomSheet({
            contents: (
                <ReceiveFundsContent
                    account={account ?? undefined}
                    chainId={chainId}
                />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [
        onFinished,
        account,
        chainId,
        setCanSelectAccount,
        setSelectedAccount,
        setReceiveChainId,
        requestBottomSheet,
    ])

    return {
        chainId,
        networkName: chainDisplayNameOf(chainId) ?? chainId,
        canReceive,
        handleAssetSelected,
        handleReceive,
    }
}
