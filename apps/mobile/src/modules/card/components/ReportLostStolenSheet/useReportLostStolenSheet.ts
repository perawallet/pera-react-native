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

import { useCallback } from 'react'
import { useCardStore } from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import { trackEvent, CardEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useSendEmail } from '@hooks/useSendEmail'
import { useCardFreezeAction } from '../../hooks'

type UseReportLostStolenSheetResult = {
    /** True while the freeze request is in flight — drives the confirm button. */
    isFreezing: boolean
    onConfirm: () => void
    onClose: () => void
}

/**
 * Baanx can't cancel cards, so a lost/stolen report freezes the card first
 * (skipped when already frozen) and then opens a support email. Freeze failure
 * keeps the sheet open for a retry; the email is best-effort.
 */
export const useReportLostStolenSheet = (): UseReportLostStolenSheetResult => {
    const { t } = useLanguage()
    const { sendEmail } = useSendEmail()
    const panLast4 = useCardStore(state => state.lastKnownPanLast4)

    const onFrozen = useCallback(() => {
        sendEmail({
            to: config.cardSupportEmail,
            subject: t('peraCard.account.report_lost_email_subject'),
            body: t('peraCard.account.report_lost_email_body', {
                panLast4: panLast4 ?? '-',
            }),
        })
    }, [sendEmail, panLast4, t])

    const { isFreezing, onConfirm, onClose } = useCardFreezeAction({ onFrozen })

    // The design's lost-card spec has separate cancel/close affordances; this
    // sheet has a single dismiss, tracked as close.
    const handleConfirm = useCallback(() => {
        trackEvent(CardEvent.LostCardFileReport)
        onConfirm()
    }, [onConfirm])
    const handleClose = useCallback(() => {
        trackEvent(CardEvent.LostCardClose)
        onClose()
    }, [onClose])

    return { isFreezing, onConfirm: handleConfirm, onClose: handleClose }
}
