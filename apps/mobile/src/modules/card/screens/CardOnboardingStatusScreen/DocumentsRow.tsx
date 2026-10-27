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
import { Trans } from 'react-i18next'
import { type I18nKey, i18nKey } from '@perawallet/wallet-core-chain-contract'
import {
    PWButton,
    PWText,
    type IconName,
    type PWIconVariant,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { StatusChecklistRow } from './StatusChecklistRow'
import type { DocumentsState } from './documentsState'
import { useStyles } from './styles'

// Icon, color, and copy for the "Submit Your Documents" row per KYC state.
const DOCUMENTS_ROW: Record<
    DocumentsState,
    {
        icon: IconName
        variant: PWIconVariant
        bodyKey: I18nKey
        showsPendingLabel: boolean
    }
> = {
    locked: {
        icon: 'pending',
        variant: 'secondary',
        bodyKey: i18nKey('peraCard.setup_status.documents_locked_body'),
        showsPendingLabel: false,
    },
    unverified: {
        icon: 'pending',
        variant: 'primary',
        bodyKey: i18nKey('peraCard.setup_status.documents_unverified_body'),
        showsPendingLabel: false,
    },
    pending: {
        icon: 'pending',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.documents_pending_body'),
        showsPendingLabel: true,
    },
    verified: {
        icon: 'check',
        variant: 'positive',
        bodyKey: i18nKey('peraCard.setup_status.documents_verified_body'),
        showsPendingLabel: false,
    },
    preparing: {
        icon: 'pending',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.documents_preparing_body'),
        showsPendingLabel: true,
    },
    'preparing-slow': {
        icon: 'pending',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.documents_preparing_slow_body'),
        showsPendingLabel: true,
    },
    'preparing-stalled': {
        icon: 'info',
        variant: 'error',
        bodyKey: i18nKey(
            'peraCard.setup_status.documents_preparing_stalled_body',
        ),
        showsPendingLabel: false,
    },
    'sign-in-required': {
        icon: 'info',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.sign_in_to_finish_body'),
        showsPendingLabel: false,
    },
    'record-missing': {
        icon: 'info',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.documents_record_missing_body'),
        showsPendingLabel: false,
    },
    'account-locked': {
        icon: 'cross',
        variant: 'error',
        bodyKey: i18nKey('peraCard.setup_status.documents_account_locked_body'),
        showsPendingLabel: false,
    },
    rejected: {
        icon: 'cross',
        variant: 'error',
        bodyKey: i18nKey('peraCard.setup_status.documents_rejected_body'),
        showsPendingLabel: false,
    },
    error: {
        icon: 'info',
        variant: 'error',
        bodyKey: i18nKey('peraCard.setup_status.documents_error_body'),
        showsPendingLabel: false,
    },
}

type DocumentsRowProps = {
    documentsState: DocumentsState
    onRetry: () => void
    /** Resumes KYC from the unverified state. */
    onVerify: () => void
    onOpenSupport: () => void
    /** Enables the "Try again" login while the account is being set up. */
    canTryAgain: boolean
    onTryAgain: () => void
    onSignIn: () => void
}

export const DocumentsRow = ({
    documentsState,
    onRetry,
    onVerify,
    onOpenSupport,
    canTryAgain,
    onTryAgain,
    onSignIn,
}: DocumentsRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const row = DOCUMENTS_ROW[documentsState]

    return (
        <StatusChecklistRow
            icon={row.icon}
            iconVariant={row.variant}
            isInactive={documentsState === 'locked'}
            pendingLabel={
                row.showsPendingLabel
                    ? t('peraCard.setup_status.documents_pending_label')
                    : undefined
            }
            title={t('peraCard.setup_status.documents_title')}
            body={t(row.bodyKey)}
            testID='card-onboarding-status-documents'
        >
            {documentsState === 'unverified' ? (
                <PWButton
                    variant='primary'
                    title={t('peraCard.setup_status.documents_verify_button')}
                    onPress={onVerify}
                    style={styles.detailsButton}
                    testID='card-onboarding-status-documents-verify'
                />
            ) : null}
            {documentsState === 'preparing' ||
            documentsState === 'preparing-slow' ? (
                <PWButton
                    variant='secondary'
                    title={t('peraCard.setup_status.documents_retry')}
                    onPress={onTryAgain}
                    isDisabled={!canTryAgain}
                    style={styles.detailsButton}
                    testID='card-onboarding-status-documents-try-again'
                />
            ) : null}
            {documentsState === 'sign-in-required' ||
            documentsState === 'record-missing' ? (
                <PWButton
                    variant='primary'
                    title={t('peraCard.sign_in.submit_button')}
                    onPress={onSignIn}
                    style={styles.detailsButton}
                    testID='card-onboarding-status-documents-sign-in'
                />
            ) : null}
            {documentsState === 'preparing-slow' ||
            documentsState === 'preparing-stalled' ||
            documentsState === 'account-locked' ? (
                <PWText
                    variant='footnoteMedium'
                    weight={400}
                >
                    <Trans
                        i18nKey='peraCard.verification.contact_us'
                        components={[
                            <PWText
                                key='link'
                                variant='linkPositive'
                                onPress={onOpenSupport}
                                testID='card-onboarding-status-documents-contact-link'
                            />,
                        ]}
                    />
                </PWText>
            ) : null}
            {documentsState === 'error' ? (
                <PWButton
                    variant='secondary'
                    title={t('peraCard.setup_status.documents_retry')}
                    onPress={onRetry}
                    style={styles.detailsButton}
                    testID='card-onboarding-status-documents-retry'
                />
            ) : null}
        </StatusChecklistRow>
    )
}
