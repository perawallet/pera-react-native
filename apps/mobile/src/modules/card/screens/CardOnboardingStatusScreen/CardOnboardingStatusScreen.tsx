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
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import {
    PWButton,
    PWScreen,
    PWText,
    PWView,
    type IconName,
    type PWIconVariant,
} from '@components/core'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
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
        isRegistrationComplete,
        isFundsConnected,
        connectedAccount,
        connectedAddress,
        isConnecting,
        handleEnterDetails,
        handleConnectAccount,
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

                    {/* 2 — Enter Your Details (done once registration completes) */}
                    <StatusChecklistRow
                        icon={isRegistrationComplete ? 'check' : 'person'}
                        iconVariant={
                            isRegistrationComplete ? 'positive' : 'primary'
                        }
                        title={t('peraCard.setup_status.details_title')}
                        body={
                            isRegistrationComplete
                                ? undefined
                                : t('peraCard.setup_status.details_body')
                        }
                        testID='card-onboarding-status-details'
                    >
                        {!isRegistrationComplete &&
                        documentsState !== 'rejected' ? (
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

                    {/* 3 — Connect Funds (inactive → active → connected) */}
                    {isFundsConnected ? (
                        <StatusChecklistRow
                            icon='check'
                            iconVariant='positive'
                            title={t(
                                'peraCard.setup_status.connect_funds_title',
                            )}
                            testID='card-onboarding-status-connect-funds'
                        >
                            <PWView style={styles.connectedCard}>
                                {connectedAccount ? (
                                    <AccountDisplay
                                        account={connectedAccount}
                                        showChevron={false}
                                        noBorder
                                        iconProps={{ size: 'sm' }}
                                        style={styles.connectedAccountInfo}
                                        testID='card-onboarding-status-connected-account'
                                    />
                                ) : (
                                    <PWText
                                        variant='body'
                                        weight={400}
                                        style={styles.connectedAccountInfo}
                                        testID='card-onboarding-status-connected-account'
                                    >
                                        {truncateAlgorandAddress(
                                            connectedAddress ?? '',
                                        )}
                                    </PWText>
                                )}
                                <PWText
                                    variant='linkPositive'
                                    onPress={handleConnectAccount}
                                    testID='card-onboarding-status-change-account'
                                >
                                    {t('peraCard.connect_account.change')}
                                </PWText>
                            </PWView>
                        </StatusChecklistRow>
                    ) : isRegistrationComplete ? (
                        <StatusChecklistRow
                            icon='wallet'
                            iconVariant='primary'
                            title={t(
                                'peraCard.setup_status.connect_funds_title',
                            )}
                            body={t('peraCard.setup_status.connect_funds_body')}
                            testID='card-onboarding-status-connect-funds'
                        >
                            <PWButton
                                variant='primary'
                                title={t(
                                    'peraCard.setup_status.connect_funds_button',
                                )}
                                onPress={handleConnectAccount}
                                isLoading={isConnecting}
                                isDisabled={isConnecting}
                                style={styles.detailsButton}
                                testID='card-onboarding-status-connect-cta'
                            />
                        </StatusChecklistRow>
                    ) : (
                        <StatusChecklistRow
                            icon='wallet'
                            iconVariant='secondary'
                            isInactive
                            title={t(
                                'peraCard.setup_status.connect_funds_title',
                            )}
                            testID='card-onboarding-status-connect-funds'
                        />
                    )}

                    {/* 4 — Select Funding Type (deferred future slice) */}
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
