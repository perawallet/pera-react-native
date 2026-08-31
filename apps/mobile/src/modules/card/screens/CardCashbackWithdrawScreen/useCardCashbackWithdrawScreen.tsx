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

import { useCallback, useMemo, useRef } from 'react'
import { Decimal } from 'decimal.js'
import { useCardRewardWalletQuery } from '@perawallet/wallet-core-card'
import { type Maybe } from '@perawallet/wallet-core-shared'
import { useNavigation } from '@react-navigation/native'
import { useNumberPadAmount } from '@components/NumberPad'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { CashbackWithdrawConfirmationSheet } from '../../components/CashbackWithdrawConfirmationSheet'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

// Cashback pays out in USDC (6 decimals); caps the typed fraction length.
const USDC_DECIMALS = 6

type UseCardCashbackWithdrawScreenResult = {
    /** Withdrawable cashback balance, formatted. */
    balanceDisplay: string
    /** Raw typed amount string, or null/undefined when empty. */
    amount: Maybe<string>
    handleKey: (key?: string) => void
    isWithdrawDisabled: boolean
    onWithdraw: () => void
}

export const useCardCashbackWithdrawScreen =
    (): UseCardCashbackWithdrawScreenResult => {
        const navigation = useNavigation()
        const { request: requestBottomSheet } = useBottomSheet()
        const { t } = useLanguage()
        const { successToast } = useToast()

        const { rewardWallet } = useCardRewardWalletQuery()
        const rewardBalance = useMemo(
            () => rewardWallet?.balance ?? new Decimal(0),
            [rewardWallet],
        )

        const {
            amount: value,
            amountDecimal,
            handleKey,
        } = useNumberPadAmount({ decimals: USDC_DECIMALS })

        const balanceDisplay = useMemo(
            () => rewardBalance.toFixed(USDC_DISPLAY_PRECISION),
            [rewardBalance],
        )

        const isValidAmount =
            amountDecimal.gt(0) && amountDecimal.lte(rewardBalance)
        const isWithdrawDisabled =
            !rewardWallet?.isWithdrawable || !isValidAmount

        const isConfirmationOpenRef = useRef(false)

        const openConfirmation = useCallback(async () => {
            // Guard re-entry so a double-tap can't queue a second sheet request.
            if (isConfirmationOpenRef.current) return
            isConfirmationOpenRef.current = true
            try {
                const result = await requestBottomSheet<'confirm'>({
                    contents: (
                        <CashbackWithdrawConfirmationSheet
                            amount={amountDecimal}
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (result !== 'confirm') return

                successToast(
                    t('peraCard.cashback.success_title'),
                    t('peraCard.cashback.success_body', {
                        amount: amountDecimal.toFixed(USDC_DISPLAY_PRECISION),
                    }),
                )
                // Skip navigation if the screen lost focus while the sheet was up.
                if (navigation.isFocused()) {
                    navigation.goBack()
                }
            } finally {
                isConfirmationOpenRef.current = false
            }
        }, [requestBottomSheet, successToast, t, amountDecimal, navigation])

        const onWithdraw = useCallback(() => {
            void openConfirmation()
        }, [openConfirmation])

        return {
            balanceDisplay,
            amount: value,
            handleKey,
            isWithdrawDisabled,
            onWithdraw,
        }
    }
