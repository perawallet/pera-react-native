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
import { useAccountChainId } from '@perawallet/wallet-core-accounts'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { useSwapScope } from '@perawallet/wallet-core-swaps'
import { trackEvent, HomeEvent, AnalyticsMetadataKey } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useAccountOverviewModal } from '../AccountOverview/AccountOverviewModalContext'

export type UseButtonPanelResult = {
    canSwap: boolean
    canSend: boolean
    canReceive: boolean
    handleSwap: () => void
    handleSend: () => void
    handleReceive: () => void
    handleMore: () => void
}

export const useButtonPanel = (): UseButtonPanelResult => {
    const navigation = useAppNavigation()
    const { account, openSendFunds, openReceiveFunds, openAccountOptions } =
        useAccountOverviewModal()
    const canSwap = useSwapScope(account) !== null
    const chainId = useAccountChainId(account, LEGACY_CHAIN_ID)
    const canSend = useChainCapability(chainId, 'send')
    const canReceive = useChainCapability(chainId, 'receive')

    const handleSwap = useCallback(() => {
        trackEvent(HomeEvent.Swap, { [AnalyticsMetadataKey.ChainId]: chainId })
        navigation.replace('TabBar', { screen: 'Swap' })
    }, [chainId, navigation])

    return {
        canSwap,
        canSend,
        canReceive,
        handleSwap,
        handleSend: openSendFunds,
        handleReceive: openReceiveFunds,
        handleMore: openAccountOptions,
    }
}
