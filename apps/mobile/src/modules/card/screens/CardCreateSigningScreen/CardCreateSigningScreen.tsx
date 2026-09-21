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

import React from 'react'
import {
    AUTO_FUNDING_PER_TX_LIMIT_USD,
    FundingType,
} from '@perawallet/wallet-core-card'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { CardStepRow } from '../../components/CardStepRow'
import { useCardCreateSigningScreen } from './useCardCreateSigningScreen'
import { useStyles } from './styles'

const STEP_LABEL_KEYS = {
    ownership: 'peraCard.signing.step_ownership_label',
    create: 'peraCard.signing.step_create_label',
    autoFunding: 'peraCard.signing.step_auto_funding_label',
} as const

export const CardCreateSigningScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        fundingType,
        connectedAccount,
        steps,
        isRunning,
        hasFailed,
        isComplete,
        canContinueWithManual,
        onCreate,
        onContinueWithManual,
    } = useCardCreateSigningScreen()
    const isAutoFunding = fundingType === FundingType.Auto

    return (
        <PWScreen
            testID='card-create-signing'
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t(
                            hasFailed
                                ? 'peraCard.signing.retry_button'
                                : 'peraCard.setup_status.funding_type_button',
                        )}
                        onPress={onCreate}
                        isLoading={isRunning}
                        isDisabled={isComplete}
                        testID='card-create-signing-proceed'
                    />
                    {canContinueWithManual && (
                        <PWButton
                            variant='linkNeutral'
                            title={t('peraCard.signing.continue_manual_button')}
                            onPress={onContinueWithManual}
                            isDisabled={isRunning}
                            testID='card-create-signing-continue-manual'
                        />
                    )}
                </PWView>
            }
        >
            <PWView style={styles.content}>
                <PWText variant='h1'>{t('peraCard.signing.title')}</PWText>
                <PWText
                    variant='bodyLarge'
                    style={styles.body}
                >
                    {t(
                        isAutoFunding
                            ? 'peraCard.signing.body_auto'
                            : 'peraCard.signing.body_manual',
                    )}
                </PWText>
                <PWView style={styles.summary}>
                    <PWView style={styles.summaryRow}>
                        <PWText
                            variant='footnoteMedium'
                            style={styles.summaryLabel}
                        >
                            {t('peraCard.signing.linked_account_label')}
                        </PWText>
                        {connectedAccount && (
                            <AccountDisplay
                                account={connectedAccount}
                                showChevron={false}
                                noBorder
                                compact
                                iconProps={{ size: 'sm' }}
                                testID='card-create-signing-account'
                            />
                        )}
                    </PWView>
                    <PWView style={styles.summaryRow}>
                        <PWText
                            variant='footnoteMedium'
                            style={styles.summaryLabel}
                        >
                            {t('peraCard.signing.funding_type_label')}
                        </PWText>
                        <PWText
                            variant='body'
                            weight={500}
                        >
                            {t(
                                isAutoFunding
                                    ? 'peraCard.setup_status.funding_type_auto_title'
                                    : 'peraCard.setup_status.funding_type_manual_title',
                            )}
                        </PWText>
                        {isAutoFunding && (
                            <PWText
                                variant='footnoteMedium'
                                style={styles.summaryHint}
                            >
                                {t(
                                    'peraCard.setup_status.funding_type_limit_hint',
                                    {
                                        limit: formatCurrency(
                                            AUTO_FUNDING_PER_TX_LIMIT_USD,
                                            0,
                                            'USD',
                                        ),
                                    },
                                )}
                            </PWText>
                        )}
                    </PWView>
                </PWView>
                <PWView style={styles.steps}>
                    {steps.map(step => (
                        <CardStepRow
                            key={step.id}
                            stepNumber={step.stepNumber}
                            label={t(STEP_LABEL_KEYS[step.id])}
                            status={step.status}
                            isBusy={step.isBusy}
                            testID={`card-create-signing-step-${step.id}`}
                        />
                    ))}
                </PWView>
            </PWView>
        </PWScreen>
    )
}
