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
    PWIcon,
    PWScreen,
    PWText,
    PWView,
    type IconName,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    useCardOnboardingStatusScreen,
    type DocumentsState,
} from './useCardOnboardingStatusScreen'
import { useStyles } from './styles'

// The "Submit Your Documents" row per KYC state. The pending icon is the
// closest available to the design's hourglass.
// TODO(card): swap to an hourglass icon when the asset is exported.
const DOCUMENTS_ROW: Record<
    DocumentsState,
    { icon: IconName; bodyKey: string; showsPendingLabel: boolean }
> = {
    pending: {
        icon: 'reload',
        bodyKey: 'peraCard.setup_status.documents_pending_body',
        showsPendingLabel: true,
    },
    verified: {
        icon: 'check',
        bodyKey: 'peraCard.setup_status.documents_verified_body',
        showsPendingLabel: false,
    },
    rejected: {
        icon: 'cross',
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
                    <PWView
                        style={styles.row}
                        testID='card-onboarding-status-documents'
                    >
                        <PWIcon
                            name={documentsRow.icon}
                            variant={
                                documentsState === 'verified'
                                    ? 'positive'
                                    : documentsState === 'rejected'
                                      ? 'error'
                                      : 'secondary'
                            }
                        />
                        <PWView style={styles.rowTexts}>
                            {documentsRow.showsPendingLabel ? (
                                <PWText
                                    variant='footnoteMedium'
                                    style={styles.pendingLabel}
                                    testID='card-onboarding-status-pending-label'
                                >
                                    {t(
                                        'peraCard.setup_status.documents_pending_label',
                                    )}
                                </PWText>
                            ) : null}
                            <PWText variant='bodyLarge'>
                                {t('peraCard.setup_status.documents_title')}
                            </PWText>
                            <PWText
                                variant='footnoteMedium'
                                weight={400}
                                style={styles.rowBody}
                            >
                                {t(documentsRow.bodyKey)}
                            </PWText>
                        </PWView>
                    </PWView>

                    {/* 2 — Enter Your Details (actionable unless rejected) */}
                    <PWView style={styles.row}>
                        <PWIcon
                            name='person'
                            variant='primary'
                        />
                        <PWView style={styles.rowTexts}>
                            <PWText variant='bodyLarge'>
                                {t('peraCard.setup_status.details_title')}
                            </PWText>
                            <PWText
                                variant='footnoteMedium'
                                weight={400}
                                style={styles.rowBody}
                            >
                                {t('peraCard.setup_status.details_body')}
                            </PWText>
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
                        </PWView>
                    </PWView>

                    {/* 3 + 4 — future slices, rendered as inactive steps */}
                    <PWView style={styles.row}>
                        <PWIcon
                            name='wallet'
                            variant='secondary'
                        />
                        <PWView style={styles.rowTexts}>
                            <PWText
                                variant='bodyLarge'
                                style={styles.inactiveTitle}
                            >
                                {t('peraCard.setup_status.connect_funds_title')}
                            </PWText>
                        </PWView>
                    </PWView>
                    <PWView style={styles.row}>
                        <PWIcon
                            name='fund'
                            variant='secondary'
                        />
                        <PWView style={styles.rowTexts}>
                            <PWText
                                variant='bodyLarge'
                                style={styles.inactiveTitle}
                            >
                                {t('peraCard.setup_status.funding_type_title')}
                            </PWText>
                        </PWView>
                    </PWView>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
