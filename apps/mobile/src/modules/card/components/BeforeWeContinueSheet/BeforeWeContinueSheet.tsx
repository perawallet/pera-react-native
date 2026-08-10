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

import { trackEvent, CardEvent } from '@analytics'
import { PWIcon } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { CardConfirmationSheet } from '../CardConfirmationSheet'

/**
 * Second step of the report-suspicious flow: a heads-up to verify with other
 * authorised users before continuing with the report. Confirm resolves
 * `continue` so the flow proceeds to transaction selection; a dismiss (Cancel /
 * pan-down) resolves the request with `undefined`.
 */
export const BeforeWeContinueSheet = () => {
    const { t } = useLanguage()
    const { resolve, dismiss } = useBottomSheetResult<'continue'>()

    return (
        <CardConfirmationSheet
            header={
                <PWIcon
                    name='error-circle'
                    variant='error'
                    size='xxl'
                />
            }
            title={t('peraCard.account.report_suspicious_before_title')}
            body={t('peraCard.account.report_suspicious_before_body')}
            confirmLabel={t(
                'peraCard.account.report_suspicious_before_confirm',
            )}
            closeLabel={t('common.cancel.label')}
            onConfirm={() => {
                trackEvent(CardEvent.ReportSusFileReport)
                resolve('continue')
            }}
            onClose={() => {
                trackEvent(CardEvent.ReportSusCancel)
                dismiss()
            }}
            testID='report_suspicious_before_continue_sheet'
            confirmTestID='report_suspicious_continue_button'
            closeTestID='report_suspicious_cancel_button'
        />
    )
}
