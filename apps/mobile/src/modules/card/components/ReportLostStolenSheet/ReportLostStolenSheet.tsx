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

import { useLanguage } from '@hooks/useLanguage'
import { CardConfirmationSheet } from '../CardConfirmationSheet'
import { CardBadgeGlyph } from '../CardBadgeGlyph'
import { useReportLostStolenSheet } from './useReportLostStolenSheet'

/** Lost/stolen report: freezes the card, then opens the support email. */
export const ReportLostStolenSheet = () => {
    const { t } = useLanguage()
    const { isFreezing, onConfirm, onClose } = useReportLostStolenSheet()

    return (
        <CardConfirmationSheet
            header={<CardBadgeGlyph size='lg' />}
            title={t('peraCard.account.report_lost_sheet_title')}
            body={t('peraCard.account.report_lost_sheet_body')}
            confirmLabel={t('peraCard.account.report_lost_sheet_confirm')}
            isPending={isFreezing}
            onConfirm={onConfirm}
            onClose={onClose}
            testID='report_lost_stolen_sheet'
            confirmTestID='report_lost_confirm_button'
            closeTestID='report_lost_close_button'
        />
    )
}
