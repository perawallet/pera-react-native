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
import {
    useAccountBalancesInvalidator,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useCardInternalWalletsQuery } from '@perawallet/wallet-core-card'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'
import { useNavigation } from '@react-navigation/native'
import { useNumberPadAmount } from '@components/NumberPad'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { CardWithdrawConfirmationSheet } from '../../components/CardWithdrawConfirmationSheet'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

// USDC on Algorand has 6 decimals; caps the typed amount's fraction length.
// Hardcoded because withdraw is USDC-only and never fetches the asset object.
const USDC_DECIMALS = 6

type UseCardWithdrawScreenResult = {
    /** Destination account (active account placeholder until the contract links one). */
    destinationAccount: Nullable<WalletAccount>
    /** Spendable card USDC balance, formatted. */
    balanceDisplay: string
    /** Raw typed amount string, or null/undefined when empty. */
    amount: Maybe<string>
    handleKey: (key?: string) => void
    isWithdrawDisabled: boolean
    onWithdraw: () => void
}

export const useCardWithdrawScreen = (): UseCardWithdrawScreenResult => {
    const navigation = useNavigation()
    const { request: requestBottomSheet } = useBottomSheet()
    const { t } = useLanguage()
    const { successToast } = useToast()
    const { invalidate: invalidateBalances } = useAccountBalancesInvalidator()

    // TODO(card): use connectedFundingSourceAddress once the smart contract
    // links the card's funding source; until then withdraw to the active account.
    const destinationAccount = useSelectedAccount()

    const { usdcWallet } = useCardInternalWalletsQuery()
    const cardBalance = useMemo(
        () => usdcWallet?.balance ?? new Decimal(0),
        [usdcWallet],
    )

    const {
        amount: value,
        amountDecimal,
        handleKey,
    } = useNumberPadAmount({ decimals: USDC_DECIMALS })

    const balanceDisplay = useMemo(
        () => cardBalance.toFixed(USDC_DISPLAY_PRECISION),
        [cardBalance],
    )

    const isValidAmount = amountDecimal.gt(0) && amountDecimal.lte(cardBalance)
    const isWithdrawDisabled =
        !destinationAccount || !usdcWallet || !isValidAmount

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

            // The mutation already invalidated the card queries; the on-chain
            // account balance (incoming USDC) is the app's to refresh.
            successToast(
                t('peraCard.withdraw.success_title'),
                t('peraCard.withdraw.success_body', {
                    amount: amountDecimal.toFixed(USDC_DISPLAY_PRECISION),
                }),
            )
            invalidateBalances()
            // Skip navigation if the screen lost focus while the sheet was up.
            if (navigation.isFocused()) {
                navigation.goBack()
            }
        } finally {
            isConfirmationOpenRef.current = false
        }
    }, [
        requestBottomSheet,
        successToast,
        t,
        amountDecimal,
        invalidateBalances,
        navigation,
    ])

    const onWithdraw = useCallback(() => {
        void openConfirmation()
    }, [openConfirmation])

    return {
        destinationAccount,
        balanceDisplay,
        amount: value,
        handleKey,
        isWithdrawDisabled,
        onWithdraw,
    }
}
