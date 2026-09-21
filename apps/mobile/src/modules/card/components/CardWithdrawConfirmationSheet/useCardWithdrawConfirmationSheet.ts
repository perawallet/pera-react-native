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
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import {
    useCardErrorToast,
    useCardEscrowBalance,
    useCardOwnerAccount,
    useCardWithdraw,
} from '../../hooks'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

type UseCardWithdrawConfirmationSheetParams = {
    /** Withdraw amount in display units (whole USDC). */
    amount: Decimal
}

type UseCardWithdrawConfirmationSheetResult = {
    /** Amount formatted for display, e.g. "25.50". */
    amountDisplay: string
    destinationAccount: Nullable<WalletAccount>
    /** True while the request is being signed and submitted. */
    isWithdrawing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Owns the `withdrawalRequest` call for the confirmation sheet so the pending
 * state lives on the sheet's button. Success resolves the sheet; a failure
 * surfaces a toast and keeps it open for a retry; backing out of the signing
 * review is a normal action and does neither.
 */
export const useCardWithdrawConfirmationSheet = ({
    amount,
}: UseCardWithdrawConfirmationSheetParams): UseCardWithdrawConfirmationSheetResult => {
    const { resolve, dismiss } = useBottomSheetResult<'confirm'>()
    const { request, isRequesting, pending } = useCardWithdraw()
    const { balance: cardBalance } = useCardEscrowBalance()
    const destinationAccount = useCardOwnerAccount()
    const showError = useCardErrorToast({
        titleKey: 'peraCard.withdraw.error_title',
        bodyKey: 'peraCard.withdraw.error_body',
        shouldUseBackendMessage: false,
    })

    const amountDisplay = useMemo(
        () => amount.toFixed(USDC_DISPLAY_PRECISION),
        [amount],
    )

    const confirm = useCallback(async () => {
        // Guard re-entry so a double-tap can't fire a second request.
        if (isRequesting) return
        // The screen validated everything, but the sheet mounts its own
        // subscribers which can refetch a lower balance or a request that
        // landed meanwhile, so re-check rather than let the contract assert.
        if (
            !destinationAccount ||
            pending !== null ||
            amount.lte(0) ||
            amount.gt(cardBalance)
        ) {
            await showError(null)
            return
        }
        try {
            await request(amount)
            resolve('confirm')
        } catch (error) {
            if (error instanceof UserRejectedSigningError) return
            await showError(error)
        }
    }, [
        isRequesting,
        destinationAccount,
        pending,
        amount,
        cardBalance,
        request,
        resolve,
        showError,
    ])

    const onConfirm = useCallback(() => {
        void confirm()
    }, [confirm])

    return {
        amountDisplay,
        destinationAccount,
        isWithdrawing: isRequesting,
        onConfirm,
        onClose: dismiss,
    }
}
