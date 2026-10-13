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

import {
    PWButton,
    PWScreen,
    PWSkeleton,
    PWText,
    PWView,
} from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { CardStepRow } from '../../components/CardStepRow'
import { useCardWithdrawStatusScreen } from './useCardWithdrawStatusScreen'
import { useStyles } from './styles'

export const CardWithdrawStatusScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        destinationAccount,
        amountDisplay,
        hasPending,
        isLoading,
        secondsUntilReady,
        isReady,
        isCompleting,
        isCancelling,
        onComplete,
        onCancel,
    } = useCardWithdrawStatusScreen()
    const isBusy = isCompleting || isCancelling

    return (
        <PWScreen
            testID='card-withdraw-status'
            footer={
                hasPending ? (
                    <PWView style={styles.footer}>
                        <PWButton
                            variant='primary'
                            title={t('peraCard.withdraw.complete_button')}
                            onPress={onComplete}
                            isDisabled={!isReady || isBusy}
                            isLoading={isCompleting}
                            testID='card_withdraw_status_complete_button'
                        />
                        <PWButton
                            variant='linkNeutral'
                            title={t('peraCard.withdraw.cancel_button')}
                            onPress={onCancel}
                            isDisabled={isBusy}
                            isLoading={isCancelling}
                            testID='card_withdraw_status_cancel_button'
                        />
                    </PWView>
                ) : undefined
            }
        >
            <PWView style={styles.content}>
                {isLoading && <PWSkeleton style={styles.amountSkeleton} />}
                {!isLoading && hasPending && (
                    <>
                        <PWText
                            variant='h1'
                            testID='card-withdraw-status-amount'
                        >
                            {amountDisplay} USDC
                        </PWText>
                        <PWView style={styles.toAccountRow}>
                            <PWText
                                variant='body'
                                style={styles.muted}
                            >
                                {t('peraCard.withdraw.to_account')}
                            </PWText>
                            <AccountDisplay
                                account={destinationAccount ?? undefined}
                                showChevron={false}
                                noBorder
                                iconProps={{ size: 'sm' }}
                                testID='card-withdraw-status-to-account'
                            />
                        </PWView>
                        <PWText
                            variant='body'
                            style={styles.muted}
                        >
                            {t('peraCard.withdraw.status_body')}
                        </PWText>
                        <PWView style={styles.stepsCard}>
                            <CardStepRow
                                stepNumber={1}
                                label={t(
                                    'peraCard.withdraw.status_step_request',
                                )}
                                status='done'
                                testID='card-withdraw-status-step-request'
                            />
                            <CardStepRow
                                stepNumber={2}
                                label={t(
                                    'peraCard.withdraw.status_step_complete',
                                )}
                                status='active'
                                isBusy={!isReady}
                                testID='card-withdraw-status-step-complete'
                            />
                            <PWText
                                variant='footnoteMedium'
                                style={styles.muted}
                                testID='card-withdraw-status-text'
                            >
                                {isReady
                                    ? t('peraCard.withdraw.status_ready')
                                    : t('peraCard.withdraw.status_waiting', {
                                          seconds: secondsUntilReady,
                                      })}
                            </PWText>
                        </PWView>
                    </>
                )}
                {!isLoading && !hasPending && (
                    <PWText
                        variant='bodyLarge'
                        style={styles.muted}
                        testID='card-withdraw-status-none'
                    >
                        {t('peraCard.withdraw.status_none')}
                    </PWText>
                )}
            </PWView>
        </PWScreen>
    )
}
