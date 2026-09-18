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
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useCardErrorToast, useCardWithdraw } from '../../hooks'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

export type PendingWithdrawalView = {
    /** Display units. */
    amount: Decimal
    secondsUntilReady: number
    isReady: boolean
    isCompleting: boolean
    isCancelling: boolean
}

type UsePeraCardPendingWithdrawalResult = {
    /** Open timelocked withdrawal, if any; the overview hosts its Complete and Cancel steps. */
    pendingWithdrawal: Nullable<PendingWithdrawalView>
    onCompleteWithdrawal: () => void
    onCancelWithdrawal: () => void
}

export const usePeraCardPendingWithdrawal =
    (): UsePeraCardPendingWithdrawalResult => {
        const { t } = useLanguage()
        const { successToast } = useToast()
        const {
            pending,
            pendingAmount,
            secondsUntilReady,
            isReady,
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

        const pendingWithdrawal = useMemo<Nullable<PendingWithdrawalView>>(
            () =>
                pending === null
                    ? null
                    : {
                          amount: pendingAmount,
                          secondsUntilReady,
                          isReady,
                          isCompleting,
                          isCancelling,
                      },
            [
                pending,
                pendingAmount,
                secondsUntilReady,
                isReady,
                isCompleting,
                isCancelling,
            ],
        )

        // Backing out of the signing review is a normal action, not a failure.
        const runStep = useCallback(
            async (step: () => Promise<void>, onDone: () => void) => {
                try {
                    await step()
                    onDone()
                } catch (error) {
                    if (error instanceof UserRejectedSigningError) return
                    logger.error('Card withdrawal step failed', { error })
                    await showError(error)
                }
            },
            [showError],
        )

        const onCompleteWithdrawal = useCallback(() => {
            const amount = pendingAmount.toFixed(USDC_DISPLAY_PRECISION)
            void runStep(complete, () =>
                successToast(
                    t('peraCard.withdraw.completed_title'),
                    t('peraCard.withdraw.completed_body', { amount }),
                ),
            )
        }, [runStep, complete, pendingAmount, successToast, t])

        const onCancelWithdrawal = useCallback(() => {
            void runStep(cancel, () =>
                successToast(
                    t('peraCard.withdraw.cancelled_title'),
                    t('peraCard.withdraw.cancelled_body'),
                ),
            )
        }, [runStep, cancel, successToast, t])

        return { pendingWithdrawal, onCompleteWithdrawal, onCancelWithdrawal }
    }
