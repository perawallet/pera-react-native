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
import { useCardRewardWalletQuery } from '@perawallet/wallet-core-card'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

const ZERO_BALANCE = new Decimal(0)

type UseCardCashbackScreenResult = {
    /** Cashback balance, formatted for display. Null only while it loads. */
    balanceDisplay: string | null
    /** Currency code, uppercased for display (e.g. "USDC"). */
    currencyDisplay: string
    isLoading: boolean
    isError: boolean
    hasBalance: boolean
    /** Withdraw gate: wallet flag AND a positive balance. */
    canWithdraw: boolean
    handleWithdraw: () => void
    refetch: () => void
}

export const useCardCashbackScreen = (): UseCardCashbackScreenResult => {
    const navigation = useAppNavigation()
    const { rewardWallet, isLoading, isError, refetch } =
        useCardRewardWalletQuery()

    const hasBalance = rewardWallet?.balance.gt(0) ?? false
    const canWithdraw =
        !isLoading &&
        !isError &&
        (rewardWallet?.isWithdrawable ?? false) &&
        hasBalance

    const handleWithdraw = useCallback(() => {
        navigation.navigate('CardCashbackWithdraw')
    }, [navigation])

    return {
        // Baanx has no reward wallet until the first cashback is credited, so a
        // settled query with no wallet is a zero balance, not a pending one.
        balanceDisplay: isLoading
            ? null
            : (rewardWallet?.balance ?? ZERO_BALANCE).toFixed(
                  USDC_DISPLAY_PRECISION,
              ),
        currencyDisplay: (rewardWallet?.currency ?? 'usdc').toUpperCase(),
        isLoading,
        isError,
        hasBalance,
        canWithdraw,
        handleWithdraw,
        refetch,
    }
}
