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
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useCardInternalWalletsQuery,
    useWithdrawFromCardMutation,
} from '@perawallet/wallet-core-card'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useCardErrorToast } from '../../hooks'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

type UseCardWithdrawConfirmationSheetParams = {
    /** Withdraw amount in display units (whole USDC). */
    amount: Decimal
}

type UseCardWithdrawConfirmationSheetResult = {
    /** Amount formatted for display, e.g. "25.50". */
    amountDisplay: string
    destinationAccount: Nullable<WalletAccount>
    /** True while the withdraw request is in flight — drives the confirm button. */
    isWithdrawing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Owns the withdraw request for the confirmation sheet so the pending state
 * lives on the sheet's button. On success it closes the sheet (`resolve`); on
 * failure it surfaces the error and keeps the sheet open so the user can retry.
 */
export const useCardWithdrawConfirmationSheet = ({
    amount,
}: UseCardWithdrawConfirmationSheetParams): UseCardWithdrawConfirmationSheetResult => {
    const { resolve, dismiss } = useBottomSheetResult<'confirm'>()
    const withdraw = useWithdrawFromCardMutation()
    const { usdcWallet } = useCardInternalWalletsQuery()
    const showError = useCardErrorToast()

    // TODO(card): use connectedFundingSourceAddress once the smart contract
    // links the card's funding source; until then withdraw to the active account.
    const destinationAccount = useSelectedAccount()

    const amountDisplay = useMemo(
        () => amount.toFixed(USDC_DISPLAY_PRECISION),
        [amount],
    )

    const confirm = useCallback(async () => {
        // Guard re-entry so a double-tap can't fire a second withdrawal.
        if (withdraw.isPending) return
        // The screen validated wallet/account/amount, but everything is
        // re-read here — mounting the sheet adds a query subscriber that can
        // refetch a lower balance, so re-check instead of relying on the
        // server's 400.
        if (
            !usdcWallet ||
            !destinationAccount ||
            amount.lte(0) ||
            amount.gt(usdcWallet.balance)
        ) {
            await showError(null)
            return
        }
        try {
            await withdraw.mutateAsync({
                amount,
                recipientAddress: destinationAccount.address,
                wallet: usdcWallet,
            })
            resolve('confirm')
        } catch (error) {
            await showError(error)
        }
    }, [withdraw, usdcWallet, destinationAccount, amount, resolve, showError])

    const onConfirm = useCallback(() => {
        void confirm()
    }, [confirm])

    return {
        amountDisplay,
        destinationAccount,
        isWithdrawing: withdraw.isPending,
        onConfirm,
        onClose: dismiss,
    }
}
