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

import { useCallback, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { useCardRewardWalletQuery } from '@perawallet/wallet-core-card'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

type UseCardCashbackScreenResult = {
    /** Cashback balance, formatted for display. */
    balanceDisplay: string
    /** Currency code, uppercased for display (e.g. "USDC"). */
    currencyDisplay: string
    isLoading: boolean
    /** Withdraw gate: wallet flag AND a positive balance. */
    canWithdraw: boolean
    handleWithdraw: () => void
    refetch: () => void
}

export const useCardCashbackScreen = (): UseCardCashbackScreenResult => {
    const navigation = useAppNavigation()
    const { rewardWallet, isLoading, refetch } = useCardRewardWalletQuery()

    const balance = useMemo(
        () => rewardWallet?.balance ?? new Decimal(0),
        [rewardWallet],
    )

    const canWithdraw = (rewardWallet?.isWithdrawable ?? false) && balance.gt(0)

    const handleWithdraw = useCallback(() => {
        navigation.navigate('CardCashbackWithdraw')
    }, [navigation])

    return {
        balanceDisplay: balance.toFixed(USDC_DISPLAY_PRECISION),
        currencyDisplay: (rewardWallet?.currency ?? 'usdc').toUpperCase(),
        isLoading,
        canWithdraw,
        handleWithdraw,
        refetch,
    }
}
