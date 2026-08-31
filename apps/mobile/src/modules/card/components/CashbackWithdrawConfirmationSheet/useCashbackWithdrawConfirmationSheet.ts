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
    useCardRewardWalletQuery,
    useRewardWithdrawEstimationQuery,
    useWithdrawRewardMutation,
} from '@perawallet/wallet-core-card'
import { type Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useCardErrorToast } from '../../hooks'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

type UseCashbackWithdrawConfirmationSheetParams = {
    /** Withdraw amount in display units. */
    amount: Decimal
}

type UseCashbackWithdrawConfirmationSheetResult = {
    /** Amount formatted for display, e.g. "12.34". */
    amountDisplay: string
    /** Network fee quote, formatted; null while loading or unavailable. */
    feeDisplay: Nullable<string>
    isEstimating: boolean
    /** True while the withdraw request is in flight — drives the confirm button. */
    isWithdrawing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Owns the reward withdraw request so the pending state lives on the sheet's
 * button. The fee quote is fetched on mount — the sheet is only mounted while
 * open, which is exactly the "confirm step" the quote belongs to. On success
 * it resolves the sheet; on failure it surfaces the error and stays open.
 */
export const useCashbackWithdrawConfirmationSheet = ({
    amount,
}: UseCashbackWithdrawConfirmationSheetParams): UseCashbackWithdrawConfirmationSheetResult => {
    const { resolve, dismiss } = useBottomSheetResult<'confirm'>()
    const withdraw = useWithdrawRewardMutation()
    const { rewardWallet } = useCardRewardWalletQuery()
    const { estimation, isLoading: isEstimating } =
        useRewardWithdrawEstimationQuery(true)
    const showError = useCardErrorToast()

    const amountDisplay = useMemo(
        () => amount.toFixed(USDC_DISPLAY_PRECISION),
        [amount],
    )

    // The payout-network fee arrives in that network's native currency
    // (payout rail TBC with Baanx), so it renders as an opaque quantity.
    const feeDisplay = useMemo(
        () => (estimation ? estimation.fee.toString() : null),
        [estimation],
    )

    const confirm = useCallback(async () => {
        // Guard re-entry so a double-tap can't fire a second withdrawal.
        if (withdraw.isPending) return
        // Re-check against the freshest balance the sheet's subscriber saw.
        if (
            !rewardWallet ||
            !rewardWallet.isWithdrawable ||
            amount.lte(0) ||
            amount.gt(rewardWallet.balance)
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
    }, [withdraw, rewardWallet, amount, showError, resolve])

    const onConfirm = useCallback(() => {
        void confirm()
    }, [confirm])

    return {
        amountDisplay,
        feeDisplay,
        isEstimating,
        isWithdrawing: withdraw.isPending,
        onConfirm,
        onClose: dismiss,
    }
}
