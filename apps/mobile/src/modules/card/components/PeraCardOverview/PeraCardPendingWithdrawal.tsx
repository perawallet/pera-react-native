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
import { PWButton, PWText, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type PeraCardPendingWithdrawalProps = {
    /** Display units. */
    amount: Decimal
    currency: string
    secondsUntilReady: number
    isReady: boolean
    isCompleting: boolean
    isCancelling: boolean
    onComplete: () => void
    onCancel: () => void
}

export const PeraCardPendingWithdrawal = ({
    amount,
    currency,
    secondsUntilReady,
    isReady,
    isCompleting,
    isCancelling,
    onComplete,
    onCancel,
}: PeraCardPendingWithdrawalProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const isBusy = isCompleting || isCancelling

    return (
        <PWView
            style={styles.pendingRow}
            testID='pera_card_pending_withdrawal'
        >
            <PWView style={styles.pendingHeader}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                >
                    {t('peraCard.withdraw.pending_title')}
                </PWText>
                <CurrencyAmount
                    value={amount}
                    currency={currency}
                    assetId={null}
                    precision='compact'
                    symbolPosition='end'
                    variant='bodyLarge'
                    weight={500}
                    style={styles.rowValue}
                />
            </PWView>
            <PWText
                variant='footnoteMedium'
                style={styles.pendingStatus}
                testID='pera_card_pending_withdrawal_status'
            >
                {isReady
                    ? t('peraCard.withdraw.pending_ready')
                    : t('peraCard.withdraw.pending_ready_in', {
                          seconds: secondsUntilReady,
                      })}
            </PWText>
            <PWView style={styles.pendingButtons}>
                <PWButton
                    variant='secondary'
                    title={t('peraCard.withdraw.cancel')}
                    onPress={onCancel}
                    isDisabled={isBusy}
                    isLoading={isCancelling}
                    testID='pera_card_pending_withdrawal_cancel'
                />
                <PWButton
                    variant='primary'
                    title={t('peraCard.withdraw.complete')}
                    onPress={onComplete}
                    isDisabled={!isReady || isBusy}
                    isLoading={isCompleting}
                    testID='pera_card_pending_withdrawal_complete'
                />
            </PWView>
        </PWView>
    )
}
