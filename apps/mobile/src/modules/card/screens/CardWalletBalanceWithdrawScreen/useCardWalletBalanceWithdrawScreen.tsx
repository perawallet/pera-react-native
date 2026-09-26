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
import {
    CardWalletKind,
    useCardWalletBalanceQuery,
} from '@perawallet/wallet-core-chain-algorand/card'
import { type Maybe, ZERO_DECIMAL } from '@perawallet/wallet-core-shared'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import { useNumberPadAmount } from '@components/NumberPad'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { WalletWithdrawConfirmationSheet } from '../../components/WalletWithdrawConfirmationSheet'
import type { PeraCardFlowParamList } from '../../routes/types'
import {
    CARD_WALLET_PRESENTATION,
    type CardWalletCopy,
} from '../../utils/cardWalletPresentation'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

type UseCardWalletBalanceWithdrawScreenResult = {
    copy: CardWalletCopy
    /** Claimable balance, formatted. */
    balanceDisplay: string
    /** Raw typed amount string, or null/undefined when empty. */
    amount: Maybe<string>
    handleKey: (key?: string) => void
    isWithdrawDisabled: boolean
    onWithdraw: () => void
}

export const useCardWalletBalanceWithdrawScreen =
    (): UseCardWalletBalanceWithdrawScreenResult => {
        const navigation = useNavigation()
        const { params } =
            useRoute<
                RouteProp<PeraCardFlowParamList, 'CardWalletBalanceWithdraw'>
            >()
        const kind = params?.kind ?? CardWalletKind.Reward
        const { copy } = CARD_WALLET_PRESENTATION[kind]
        const { request: requestBottomSheet } = useBottomSheet()
        const { t } = useLanguage()
        const { successToast } = useToast()

        const { wallet } = useCardWalletBalanceQuery(kind)
        const balance = wallet?.balance ?? ZERO_DECIMAL

        // The request carries the amount at display precision, so the pad
        // stops there too: what the user types is exactly what is claimed.
        const {
            amount: value,
            amountDecimal,
            handleKey,
        } = useNumberPadAmount({ decimals: USDC_DISPLAY_PRECISION })

        const balanceDisplay = useMemo(
            () => balance.toFixed(USDC_DISPLAY_PRECISION),
            [balance],
        )

        const isValidAmount = amountDecimal.gt(0) && amountDecimal.lte(balance)
        const isWithdrawDisabled = !wallet?.isWithdrawable || !isValidAmount

        const isConfirmationOpenRef = useRef(false)

        const openConfirmation = useCallback(async () => {
            // Guard re-entry so a double-tap can't queue a second sheet request.
            if (isConfirmationOpenRef.current) return
            isConfirmationOpenRef.current = true
            try {
                const result = await requestBottomSheet<'confirm'>({
                    contents: (
                        <WalletWithdrawConfirmationSheet
                            kind={kind}
                            amount={amountDecimal}
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (result !== 'confirm') return

                successToast(
                    t('peraCard.credits.success_title'),
                    t(copy.successBody, {
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
        }, [
            requestBottomSheet,
            successToast,
            t,
            copy.successBody,
            kind,
            amountDecimal,
            navigation,
        ])

        const onWithdraw = useCallback(() => {
            void openConfirmation()
        }, [openConfirmation])

        return {
            copy,
            balanceDisplay,
            amount: value,
            handleKey,
            isWithdrawDisabled,
            onWithdraw,
        }
    }
