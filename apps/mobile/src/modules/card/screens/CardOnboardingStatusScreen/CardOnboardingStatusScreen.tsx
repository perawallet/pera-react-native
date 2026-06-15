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

import React from 'react'
import { Trans } from 'react-i18next'
import {
    PWButton,
    PWScreen,
    PWText,
    PWView,
    type IconName,
    type PWIconVariant,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    useCardOnboardingStatusScreen,
    type DocumentsState,
} from './useCardOnboardingStatusScreen'
import { StatusChecklistRow } from './StatusChecklistRow'
import { useStyles } from './styles'

// Icon, color, and copy for the "Submit Your Documents" row per KYC state.
const DOCUMENTS_ROW: Record<
    DocumentsState,
    {
        icon: IconName
        variant: PWIconVariant
        bodyKey: string
        showsPendingLabel: boolean
    }
> = {
    pending: {
        icon: 'pending',
        variant: 'secondary',
        bodyKey: 'peraCard.setup_status.documents_pending_body',
        showsPendingLabel: true,
    },
    verified: {
        icon: 'check',
        variant: 'positive',
        bodyKey: 'peraCard.setup_status.documents_verified_body',
        showsPendingLabel: false,
    },
    rejected: {
        icon: 'cross',
        variant: 'error',
        bodyKey: 'peraCard.setup_status.documents_rejected_body',
        showsPendingLabel: false,
    },
}

export const CardOnboardingStatusScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        documentsState,
        handleEnterDetails,
        handleLogout,
        handleOpenSupport,
    } = useCardOnboardingStatusScreen()

    const documentsRow = DOCUMENTS_ROW[documentsState]

    return (
        <PWScreen
            testID='card-onboarding-status'
            footer={
                <PWView style={styles.footer}>
                    <PWButton
                        variant='secondary'
                        title={t('peraCard.verification.logout_button')}
                        onPress={handleLogout}
                        testID='card-onboarding-status-logout'
                    />
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.contactText}
                    >
                        <Trans
                            i18nKey='peraCard.verification.contact_us'
                            components={[
                                <PWText
                                    key='link'
                                    variant='linkPositive'
                                    onPress={handleOpenSupport}
                                    testID='card-onboarding-status-contact-link'
                                />,
                            ]}
                        />
                    </PWText>
                </PWView>
            }
        >
            <PWView style={styles.content}>
                <PWText variant='h1'>{t('peraCard.setup_status.title')}</PWText>

                <PWView style={styles.checklist}>
                    {/* 1 — Submit Your Documents (driven by the KYC state) */}
                    <StatusChecklistRow
                        icon={documentsRow.icon}
                        iconVariant={documentsRow.variant}
                        pendingLabel={
                            documentsRow.showsPendingLabel
                                ? t(
                                      'peraCard.setup_status.documents_pending_label',
                                  )
                                : undefined
                        }
                        title={t('peraCard.setup_status.documents_title')}
                        body={t(documentsRow.bodyKey)}
                        testID='card-onboarding-status-documents'
                    />

                    {/* 2 — Enter Your Details (actionable unless rejected) */}
                    <StatusChecklistRow
                        icon='person'
                        iconVariant='primary'
                        title={t('peraCard.setup_status.details_title')}
                        body={t('peraCard.setup_status.details_body')}
                    >
                        {documentsState !== 'rejected' ? (
                            <PWButton
                                variant='primary'
                                title={t(
                                    'peraCard.setup_status.details_button',
                                )}
                                onPress={handleEnterDetails}
                                style={styles.detailsButton}
                                testID='card-onboarding-status-details-cta'
                            />
                        ) : null}
                    </StatusChecklistRow>

                    {/* 3 + 4 — future slices, rendered as inactive steps */}
                    <StatusChecklistRow
                        icon='wallet'
                        iconVariant='secondary'
                        isInactive
                        title={t('peraCard.setup_status.connect_funds_title')}
                    />
                    <StatusChecklistRow
                        icon='fund'
                        iconVariant='secondary'
                        isInactive
                        title={t('peraCard.setup_status.funding_type_title')}
                    />
                </PWView>
            </PWView>
        </PWScreen>
    )
}
