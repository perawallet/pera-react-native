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

import type { Decimal } from 'decimal.js'
import { PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CardConfirmationSheet } from '../CardConfirmationSheet'
import { useCashbackWithdrawConfirmationSheet } from './useCashbackWithdrawConfirmationSheet'
import { useStyles } from './styles'

type CashbackWithdrawConfirmationSheetProps = {
    /** Withdraw amount in display units. */
    amount: Decimal
}

/**
 * Confirmation sheet shown before withdrawing cashback. The withdrawal runs
 * here — the confirm button shows the pending state and the sheet closes on
 * success. The network fee quote is fetched while the sheet is up.
 */
export const CashbackWithdrawConfirmationSheet = ({
    amount,
}: CashbackWithdrawConfirmationSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        amountDisplay,
        feeDisplay,
        isEstimating,
        isWithdrawing,
        onConfirm,
        onClose,
    } = useCashbackWithdrawConfirmationSheet({ amount })

    return (
        <CardConfirmationSheet
            title={t('peraCard.cashback.confirm_title')}
            body={t('peraCard.cashback.confirm_body', {
                amount: amountDisplay,
            })}
            confirmLabel={t('peraCard.cashback.confirm_button')}
            isPending={isWithdrawing}
            onConfirm={onConfirm}
            onClose={onClose}
            testID='cashback_withdraw_confirmation_sheet'
            confirmTestID='cashback_withdraw_confirm_button'
            closeTestID='cashback_withdraw_close_button'
        >
            <PWView style={styles.feeRow}>
                <PWText
                    variant='body'
                    style={styles.feeLabel}
                >
                    {t('peraCard.cashback.fee_label')}
                </PWText>
                <PWText
                    variant='body'
                    testID='cashback-withdraw-fee'
                >
                    {isEstimating || feeDisplay === null
                        ? t('peraCard.cashback.fee_loading')
                        : feeDisplay}
                </PWText>
            </PWView>
        </CardConfirmationSheet>
    )
}
