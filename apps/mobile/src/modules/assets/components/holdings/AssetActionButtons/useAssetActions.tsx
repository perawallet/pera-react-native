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
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { nativeAssetFor, type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    chainAccountOf,
    type AssetWithAccountBalance,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useReceiveFunds, useSendFunds } from '@modules/transactions'
import {
    SendFundsContent,
    SEND_FUNDS_SHEET_ID,
    ReceiveFundsContent,
} from '@modules/transactions/routes'
import { trackEvent, AssetDetailsEvent, AnalyticsMetadataKey } from '@analytics'

export type UseAssetActionsProps = {
    asset: PeraAsset
    assetHolding?: Nullable<AssetWithAccountBalance>
    chainId: ChainId
    account: Maybe<WalletAccount>
}

export type UseAssetActionsResult = {
    openReceiveFunds: () => void
    handleSwap: () => void
    handleSend: () => void
    handleCopyAddress: () => void
}

export const useAssetActions = ({
    asset,
    assetHolding,
    chainId,
    account,
}: UseAssetActionsProps): UseAssetActionsResult => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { t } = useLanguage()
    const { request: requestBottomSheet } = useBottomSheet()
    const { setSelectedAsset, setCanSelectAsset } = useSendFunds()
    const {
        setSelectedAccount: setReceiveAccount,
        setCanSelectAccount: setCanSelectReceiveAccount,
        setChainId: setReceiveChainId,
    } = useReceiveFunds()
    const { copyToClipboard } = useClipboard()
    const { showToast } = useToast()

    const openReceiveFunds = useCallback(() => {
        trackEvent(AssetDetailsEvent.Receive, {
            [AnalyticsMetadataKey.ChainId]: chainId,
        })
        // The sheet picks its first screen on its first render, before its own effects can write the store.
        if (account) {
            setCanSelectReceiveAccount(false)
            setReceiveAccount(account)
            setReceiveChainId(chainId)
        }
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
        requestBottomSheet,
        account,
        chainId,
        setCanSelectReceiveAccount,
        setReceiveAccount,
        setReceiveChainId,
    ])

    const handleSwap = useCallback(() => {
        const nativeAsset = nativeAssetFor(chainId)
        const isAlgo = asset.assetId === nativeAsset.assetId
        if (isAlgo) {
            trackEvent(AssetDetailsEvent.SwapAlgo, {
                [AnalyticsMetadataKey.ChainId]: chainId,
            })
        }
        navigation.replace('TabBar', {
            screen: 'Swap',
            params: isAlgo
                ? undefined
                : { assetInId: nativeAsset.assetId, assetOutId: asset.assetId },
        })
    }, [asset.assetId, chainId, navigation])

    const handleSend = useCallback(() => {
        trackEvent(AssetDetailsEvent.Send, {
            [AnalyticsMetadataKey.ChainId]: chainId,
        })
        if (assetHolding) {
            setSelectedAsset({ chainId, assetId: assetHolding.assetId })
            setCanSelectAsset(false)
        }

        void requestBottomSheet({
            id: SEND_FUNDS_SHEET_ID,
            contents: (
                <SendFundsContent asset={{ chainId, assetId: asset.assetId }} />
            ),
            options: {
                size: 'modal',
                enablePanDownToClose: false,
                enableCloseOnBackdropPress: false,
                autoCreateContainer: false,
            },
        })
    }, [
        assetHolding,
        setSelectedAsset,
        setCanSelectAsset,
        requestBottomSheet,
        asset.assetId,
        chainId,
    ])

    const handleCopyAddress = useCallback(() => {
        const address = account
            ? chainAccountOf(account, chainId)?.address
            : undefined
        if (address) {
            void copyToClipboard(address)
            showToast({
                title: t('account_options.copy_address'),
                body: '',
                type: 'success',
            })
        }
    }, [account, chainId, copyToClipboard, showToast, t])

    return {
        openReceiveFunds,
        handleSwap,
        handleSend,
        handleCopyAddress,
    }
}
