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
import type { Decimal } from 'decimal.js'
import {
    type CardWalletKind,
    useCardWalletBalanceQuery,
    useWithdrawWalletBalanceMutation,
} from '@perawallet/wallet-core-chain-algorand/card'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useCardErrorToast } from '../../hooks'
import {
    CARD_WALLET_PRESENTATION,
    type CardWalletCopy,
} from '../../utils/cardWalletPresentation'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

type UseWalletWithdrawConfirmationSheetParams = {
    kind: CardWalletKind
    /** Withdraw amount in display units. */
    amount: Decimal
}

type UseWalletWithdrawConfirmationSheetResult = {
    copy: CardWalletCopy
    /** Amount formatted for display, e.g. "12.34". */
    amountDisplay: string
    /** True while the withdraw request is in flight; drives the confirm button. */
    isWithdrawing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Owns the withdraw request so the pending state lives on the sheet's button.
 * On success it resolves the sheet; on failure it surfaces the error and stays
 * open.
 */
export const useWalletWithdrawConfirmationSheet = ({
    kind,
    amount,
}: UseWalletWithdrawConfirmationSheetParams): UseWalletWithdrawConfirmationSheetResult => {
    const { resolve, dismiss } = useBottomSheetResult<'confirm'>()
    const withdraw = useWithdrawWalletBalanceMutation(kind)
    const { wallet } = useCardWalletBalanceQuery(kind)
    const showError = useCardErrorToast()

    const amountDisplay = useMemo(
        () => amount.toFixed(USDC_DISPLAY_PRECISION),
        [amount],
    )

    const confirm = useCallback(async () => {
        // Guard re-entry so a double-tap can't fire a second withdrawal.
        if (withdraw.isPending) return
        // Re-check against the freshest balance the sheet's subscriber saw.
        if (
            !wallet ||
            !wallet.isWithdrawable ||
            amount.lte(0) ||
            amount.gt(wallet.balance)
        ) {
            await showError(null)
            return
        }
        try {
            await withdraw.mutateAsync({
                amount: amount.toFixed(USDC_DISPLAY_PRECISION),
            })
            resolve('confirm')
        } catch (error) {
            await showError(error)
        }
    }, [withdraw, wallet, amount, showError, resolve])

    const onConfirm = useCallback(() => {
        void confirm()
    }, [confirm])

    return {
        copy: CARD_WALLET_PRESENTATION[kind].copy,
        amountDisplay,
        isWithdrawing: withdraw.isPending,
        onConfirm,
        onClose: dismiss,
    }
}
