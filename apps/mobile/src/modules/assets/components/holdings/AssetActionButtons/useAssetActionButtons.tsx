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

import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCallback } from 'react'
import { type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    isAlgoAssetId,
    ALGO_ASSET_ID,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { SendFundsContent } from '@modules/transactions/components/send-funds/SendFundsContent'
import { ReceiveFundsContent } from '@modules/transactions/components/receive-funds/ReceiveFundsContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import {
    useSelectedAccount,
    useCanSignWith,
    type AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import { useSendFunds } from '@modules/transactions/hooks'
import { useClipboard } from '@hooks/useClipboard'
import { useToast } from '@hooks/useToast'
import { trackEvent, AssetDetailsEvent } from '@analytics'

export type UseAssetActionButtonsParams = {
    asset: PeraAsset
    assetHolding?: Nullable<AssetWithAccountBalance>
}

export type UseAssetActionButtonsResult = {
    isReadOnly: boolean
    /** This account's holding is frozen, so it can't be moved on chain. */
    isFrozen: boolean
    handleSwap: () => void
    handleSend: () => void
    handleBuy: () => void
    handleReceive: () => void
    handleCopyAddress: () => void
}

export const useAssetActionButtons = ({
    asset,
    assetHolding,
}: UseAssetActionButtonsParams): UseAssetActionButtonsResult => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()
    const account = useSelectedAccount()
    const { request: requestBottomSheet } = useBottomSheet()
    const isReadOnly = !useCanSignWith(account)
    const { setSelectedAssetId, setCanSelectAsset } = useSendFunds()
    const { copyToClipboard } = useClipboard()
    const { showToast } = useToast()

    // Freeze is per holding, not per asset: a creator who froze the asset for
    // everyone else still holds an unfrozen balance of their own.
    const isFrozen = assetHolding?.isFrozen ?? false

    // The buttons stay tappable while dimmed so this can explain the block,
    // rather than the press being silently swallowed.
    const showFrozenNotice = useCallback(() => {
        showToast({
            title: t('asset_details.frozen_notice.title'),
            body: t('asset_details.frozen_notice.body'),
            type: 'warning',
        })
    }, [showToast, t])

    const handleReceive = useCallback(() => {
        trackEvent(AssetDetailsEvent.Receive)
        void requestBottomSheet({
            contents: <ReceiveFundsContent account={account ?? undefined} />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet, account])

    const handleBuy = useCallback(() => {
        navigation.replace('TabBar', { screen: 'Fund' })
    }, [navigation])

    const handleSwap = useCallback(() => {
        // A frozen holding can neither send nor receive, so the swap would be
        // rejected on chain whichever leg this asset lands on.
        if (isFrozen) {
            showFrozenNotice()
            return
        }
        const isAlgo = isAlgoAssetId(asset.assetId)
        if (isAlgo) {
            trackEvent(AssetDetailsEvent.SwapAlgo)
        }
        navigation.replace('TabBar', {
            screen: 'Swap',
            params: isAlgo
                ? undefined
                : { assetInId: ALGO_ASSET_ID, assetOutId: asset.assetId },
        })
    }, [asset.assetId, navigation, isFrozen, showFrozenNotice])

    const handleSend = useCallback(() => {
        if (isFrozen) {
            showFrozenNotice()
            return
        }
        trackEvent(AssetDetailsEvent.Send)
        if (assetHolding) {
            setSelectedAssetId(assetHolding.assetId)
            setCanSelectAsset(false)
        }

        void requestBottomSheet({
            contents: <SendFundsContent assetId={asset.assetId} />,
            options: {
                size: 'modal',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
                autoCreateContainer: false,
            },
        })
    }, [
        assetHolding,
        setSelectedAssetId,
        setCanSelectAsset,
        requestBottomSheet,
        asset.assetId,
        isFrozen,
        showFrozenNotice,
    ])

    const handleCopyAddress = useCallback(() => {
        if (account) {
            void copyToClipboard(account.address)
            showToast({
                title: t('account_options.copy_address'),
                body: '',
                type: 'success',
            })
        }
    }, [account, copyToClipboard, showToast, t])

    return {
        isReadOnly,
        isFrozen,
        handleSwap,
        handleSend,
        handleBuy,
        handleReceive,
        handleCopyAddress,
    }
}
