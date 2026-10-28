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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { findNativeAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { trackEvent, HomeEvent, AnalyticsMetadataKey } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useAssetActionButtons } from '@modules/assets'
import { useAccountOverviewModal } from '../../AccountOverview/AccountOverviewModalContext'

export type NetworkFundingStateProps = {
    account: WalletAccount
    chainId: ChainId
}

export type UseNetworkFundingStateResult = {
    title: string
    body: string
    canReceive: boolean
    /** Fund buys onto this network. */
    canBuy: boolean
    /** Swap runs on this network. */
    canSwap: boolean
    handleReceive: () => void
    handleBuy: () => void
    handleSwap: () => void
}

export const useNetworkFundingState = ({
    account,
    chainId,
}: NetworkFundingStateProps): UseNetworkFundingStateResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { openReceiveFundsOn } = useAccountOverviewModal()
    const { canReceive, canBuy, canSwap } = useAssetActionButtons(
        account,
        chainId,
    )
    const network = chainDisplayNameOf(chainId) ?? chainId
    const nativeSymbol = findNativeAsset(chainId)?.unitName ?? ''

    const handleReceive = useCallback(
        () => openReceiveFundsOn(account, chainId),
        [openReceiveFundsOn, account, chainId],
    )

    const handleBuy = useCallback(() => {
        trackEvent(HomeEvent.Fund, { [AnalyticsMetadataKey.ChainId]: chainId })
        navigation.navigate('TabBar', { screen: 'Fund' })
    }, [chainId, navigation])

    const handleSwap = useCallback(() => {
        trackEvent(HomeEvent.Swap, { [AnalyticsMetadataKey.ChainId]: chainId })
        navigation.replace('TabBar', { screen: 'Swap' })
    }, [chainId, navigation])

    return {
        title: t('account_details.assets.funding_title', { network }),
        body: t('account_details.assets.funding_body', {
            network,
            nativeSymbol,
        }),
        canReceive,
        canBuy,
        canSwap,
        handleReceive,
        handleBuy,
        handleSwap,
    }
}
