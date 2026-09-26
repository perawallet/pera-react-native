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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useCardPendingWithdrawalQuery } from '@perawallet/wallet-core-card'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNumberPadAmount } from '@components/NumberPad'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardWithdrawConfirmationSheet } from '../../components/CardWithdrawConfirmationSheet'
import { useCardEscrowBalance, useCardOwnerAccount } from '../../hooks'
import type { PeraCardFlowParamList } from '../../routes/types'
import {
    USDC_DISPLAY_PRECISION,
    USDC_FALLBACK_DECIMALS,
} from '../../utils/usdc'

type UseCardWithdrawScreenResult = {
    /** Where the contract releases the funds: always the card's owner. */
    destinationAccount: Nullable<WalletAccount>
    /** USDC on the card, formatted. */
    balanceDisplay: string
    /** Raw typed amount string, or null/undefined when empty. */
    amount: Maybe<string>
    handleKey: (key?: string) => void
    isWithdrawDisabled: boolean
    /** True while an earlier request is still open, which blocks a new one. */
    hasPendingWithdrawal: boolean
    onWithdraw: () => void
}

export const useCardWithdrawScreen = (): UseCardWithdrawScreenResult => {
    const navigation =
        useNavigation<
            NativeStackNavigationProp<PeraCardFlowParamList, 'CardWithdraw'>
        >()
    const { request: requestBottomSheet } = useBottomSheet()

    const destinationAccount = useCardOwnerAccount()
    const { balance: cardBalance } = useCardEscrowBalance()
    const { pending } = useCardPendingWithdrawalQuery()

    const {
        amount: value,
        amountDecimal,
        handleKey,
    } = useNumberPadAmount({ decimals: USDC_FALLBACK_DECIMALS })

    const balanceDisplay = useMemo(
        () => cardBalance.toFixed(USDC_DISPLAY_PRECISION),
        [cardBalance],
    )

    const hasPendingWithdrawal = pending !== null
    const isValidAmount = amountDecimal.gt(0) && amountDecimal.lte(cardBalance)
    const isWithdrawDisabled =
        !destinationAccount || !isValidAmount || hasPendingWithdrawal

    const isConfirmationOpenRef = useRef(false)

    const openConfirmation = useCallback(async () => {
        // Guard re-entry so a double-tap can't queue a second sheet request.
        if (isConfirmationOpenRef.current) return
        isConfirmationOpenRef.current = true
        try {
            const result = await requestBottomSheet<'confirm'>({
                contents: (
                    <CardWithdrawConfirmationSheet amount={amountDecimal} />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (result !== 'confirm') return

            // The request only starts the timelock; the status screen takes
            // over the wait and the Complete step in place of this form.
            if (navigation.isFocused()) {
                navigation.replace('CardWithdrawStatus')
            }
        } finally {
            isConfirmationOpenRef.current = false
        }
    }, [requestBottomSheet, amountDecimal, navigation])

    const onWithdraw = useCallback(() => {
        void openConfirmation()
    }, [openConfirmation])

    return {
        destinationAccount,
        balanceDisplay,
        amount: value,
        handleKey,
        isWithdrawDisabled,
        hasPendingWithdrawal,
        onWithdraw,
    }
}
