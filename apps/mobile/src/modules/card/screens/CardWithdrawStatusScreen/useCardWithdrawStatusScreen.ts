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
import { useNavigation } from '@react-navigation/native'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    useCardErrorToast,
    useCardOwnerAccount,
    useCardWithdraw,
} from '../../hooks'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

type UseCardWithdrawStatusScreenResult = {
    /** Where the contract releases the funds: always the card's owner. */
    destinationAccount: Nullable<WalletAccount>
    /** Pending amount formatted, e.g. "25.00". */
    amountDisplay: string
    hasPending: boolean
    isLoading: boolean
    secondsUntilReady: number
    isReady: boolean
    isCompleting: boolean
    isCancelling: boolean
    onComplete: () => void
    onCancel: () => void
}

/**
 * The wait between the timelocked request and its claim. Both the Complete
 * and Cancel steps live here so the card overview stays free of transient
 * state; either outcome toasts and returns to wherever the user came from.
 */
export const useCardWithdrawStatusScreen =
    (): UseCardWithdrawStatusScreenResult => {
        const navigation = useNavigation()
        const { t } = useLanguage()
        const { successToast } = useToast()
        const destinationAccount = useCardOwnerAccount()
        const {
            pending,
            pendingAmount,
            secondsUntilReady,
            isReady,
            isPendingLoading,
            complete,
            cancel,
            isCompleting,
            isCancelling,
        } = useCardWithdraw()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.withdraw.error_title',
            bodyKey: 'peraCard.withdraw.error_body',
            shouldUseBackendMessage: false,
        })

        const amountDisplay = useMemo(
            () => pendingAmount.toFixed(USDC_DISPLAY_PRECISION),
            [pendingAmount],
        )

        // Backing out of the signing review is a normal action, not a failure.
        const runStep = useCallback(
            async (step: () => Promise<void>, onDone: () => void) => {
                try {
                    await step()
                    onDone()
                    if (navigation.isFocused()) navigation.goBack()
                } catch (error) {
                    if (error instanceof UserRejectedSigningError) return
                    logger.error('Card withdrawal step failed', { error })
                    await showError(error)
                }
            },
            [navigation, showError],
        )

        const onComplete = useCallback(() => {
            const amount = amountDisplay
            void runStep(complete, () =>
                successToast(
                    t('peraCard.withdraw.completed_title'),
                    t('peraCard.withdraw.completed_body', { amount }),
                ),
            )
        }, [amountDisplay, runStep, complete, successToast, t])

        const onCancel = useCallback(() => {
            void runStep(cancel, () =>
                successToast(
                    t('peraCard.withdraw.cancelled_title'),
                    t('peraCard.withdraw.cancelled_body'),
                ),
            )
        }, [runStep, cancel, successToast, t])

        return {
            destinationAccount,
            amountDisplay,
            hasPending: pending !== null,
            isLoading: isPendingLoading,
            secondsUntilReady,
            isReady,
            isCompleting,
            isCancelling,
            onComplete,
            onCancel,
        }
    }
