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
import { useSwapScope } from '@perawallet/wallet-core-swaps'
import { useAccountCapabilityScope } from '@perawallet/wallet-core-accounts'
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
    // Each button shows when any chain the account holds serves it; the flow
    // it opens asks which chain when more than one does.
    const swapChainId = useSwapScope(account)?.chainId
    const canSwap = swapChainId !== undefined
    const canSend = useAccountCapabilityScope(account, 'send') !== null
    const canReceive = useAccountCapabilityScope(account, 'receive') !== null

    const handleSwap = useCallback(() => {
        if (!swapChainId) return
        trackEvent(HomeEvent.Swap, {
            [AnalyticsMetadataKey.ChainId]: swapChainId,
        })
        navigation.replace('TabBar', { screen: 'Swap' })
    }, [swapChainId, navigation])

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
