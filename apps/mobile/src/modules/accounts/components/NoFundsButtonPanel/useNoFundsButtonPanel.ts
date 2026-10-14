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
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import { trackEvent, HomeEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCanFundAccount } from '@modules/onramp'
import { useAccountOverviewModal } from '../AccountOverview/AccountOverviewModalContext'

export type UseNoFundsButtonPanelResult = {
    canBuy: boolean
    handleBuy: () => void
    handleReceive: () => void
    handleMore: () => void
}

export const useNoFundsButtonPanel = (): UseNoFundsButtonPanelResult => {
    const navigation = useAppNavigation()
    const canBuy = useCanFundAccount(useSelectedAccount())
    const { openReceiveFunds, openAccountOptions } = useAccountOverviewModal()

    const handleBuy = useCallback(() => {
        trackEvent(HomeEvent.Fund)
        navigation.navigate('TabBar', { screen: 'Fund' })
    }, [navigation])

    return {
        canBuy,
        handleBuy,
        handleReceive: openReceiveFunds,
        handleMore: openAccountOptions,
    }
}
