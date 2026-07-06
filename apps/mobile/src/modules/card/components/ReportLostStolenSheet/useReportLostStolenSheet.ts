/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback } from 'react'
import {
    CardStatus,
    useCardStatusQuery,
    useCardStore,
    useFreezeCardMutation,
} from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useSendEmail } from '@hooks/useSendEmail'
import { useCardErrorToast } from '../../hooks'

type UseReportLostStolenSheetResult = {
    /** True while the freeze request is in flight — drives the confirm button. */
    isFreezing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Baanx can't cancel cards, so a lost/stolen report freezes the card first
 * (skipped when already frozen) and then opens a support email. Freeze
 * failure keeps the sheet open for a retry; the email is best-effort.
 */
export const useReportLostStolenSheet = (): UseReportLostStolenSheetResult => {
    const { t } = useLanguage()
    const { resolve, dismiss } = useBottomSheetResult<'confirm'>()
    const { data: card } = useCardStatusQuery()
    const freeze = useFreezeCardMutation()
    const { sendEmail } = useSendEmail()
    const showError = useCardErrorToast()
    const panLast4 = useCardStore(state => state.lastKnownPanLast4)

    const confirm = useCallback(async () => {
        // Guard re-entry so a double-tap can't fire a second freeze.
        if (freeze.isPending) return
        if (card?.status !== CardStatus.Frozen) {
            try {
                await freeze.mutateAsync()
            } catch (error) {
                await showError(error)
                return
            }
        }
        sendEmail({
            to: config.cardSupportEmail,
            subject: t('peraCard.account.report_lost_email_subject'),
            body: t('peraCard.account.report_lost_email_body', {
                panLast4: panLast4 ?? '-',
            }),
        })
        resolve('confirm')
    }, [freeze, card?.status, sendEmail, panLast4, resolve, showError, t])

    const onConfirm = useCallback(() => {
        void confirm()
    }, [confirm])

    return {
        isFreezing: freeze.isPending,
        onConfirm,
        onClose: dismiss,
    }
}
