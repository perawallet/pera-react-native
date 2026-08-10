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
import { trackEvent, CardEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useCardFreezeAction } from '../../hooks'
import { CardBadgeGlyph } from '../CardBadgeGlyph'
import { CardConfirmationSheet } from '../CardConfirmationSheet'

/**
 * First step of the report-suspicious flow: freeze the card before reporting.
 * Freezing runs here — the confirm button shows the pending state.
 */
export const ReportSuspiciousActivitySheet = () => {
    const { t } = useLanguage()
    const { isFreezing, onConfirm, onClose } = useCardFreezeAction()

    const handleClose = useCallback(() => {
        trackEvent(CardEvent.ReportSusClose)
        onClose()
    }, [onClose])

    return (
        <CardConfirmationSheet
            header={
                <CardBadgeGlyph
                    size='lg'
                    badge='suspicious'
                />
            }
            title={t('peraCard.account.report_suspicious_sheet_title')}
            body={t('peraCard.account.report_suspicious_sheet_body')}
            confirmLabel={t('peraCard.account.report_suspicious_sheet_confirm')}
            isPending={isFreezing}
            onConfirm={onConfirm}
            onClose={handleClose}
            testID='report_suspicious_activity_sheet'
            confirmTestID='report_suspicious_freeze_button'
            closeTestID='report_suspicious_close_button'
        />
    )
}
