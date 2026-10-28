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
import { type I18nKey, i18nKey } from '@perawallet/wallet-core-chain-contract'
import { PWButton, type IconName, type PWIconVariant } from '@components/core'
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
        /** The small label above the title, for a state that's waiting. */
        labelKey?: I18nKey
    }
> = {
    locked: {
        icon: 'pending',
        variant: 'secondary',
        bodyKey: i18nKey('peraCard.setup_status.documents_locked_body'),
    },
    unverified: {
        icon: 'pending',
        variant: 'primary',
        bodyKey: i18nKey('peraCard.setup_status.documents_unverified_body'),
    },
    pending: {
        icon: 'pending',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.documents_pending_body'),
        labelKey: i18nKey('peraCard.setup_status.documents_pending_label'),
    },
    verified: {
        icon: 'check',
        variant: 'positive',
        bodyKey: i18nKey('peraCard.setup_status.documents_verified_body'),
    },
    preparing: {
        icon: 'pending',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.documents_preparing_body'),
        labelKey: i18nKey('peraCard.setup_status.documents_preparing_label'),
    },
    'preparing-slow': {
        icon: 'pending',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.documents_preparing_slow_body'),
        labelKey: i18nKey('peraCard.setup_status.documents_preparing_label'),
    },
    'preparing-stalled': {
        icon: 'info',
        variant: 'error',
        bodyKey: i18nKey(
            'peraCard.setup_status.documents_preparing_stalled_body',
        ),
    },
    'sign-in-required': {
        icon: 'info',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.sign_in_to_finish_body'),
    },
    'record-missing': {
        icon: 'info',
        variant: 'warning',
        bodyKey: i18nKey('peraCard.setup_status.documents_record_missing_body'),
    },
    'account-locked': {
        icon: 'cross',
        variant: 'error',
        bodyKey: i18nKey('peraCard.setup_status.documents_account_locked_body'),
    },
    rejected: {
        icon: 'cross',
        variant: 'error',
        bodyKey: i18nKey('peraCard.setup_status.documents_rejected_body'),
    },
    error: {
        icon: 'info',
        variant: 'error',
        bodyKey: i18nKey('peraCard.setup_status.documents_error_body'),
    },
}

type DocumentsRowProps = {
    documentsState: DocumentsState
    onRetry: () => void
    /** Resumes KYC from the unverified state. */
    onVerify: () => void
    /** Enables the "Try again" login once setting up the account runs slow. */
    canTryAgain: boolean
    onTryAgain: () => void
    onSignIn: () => void
}

export const DocumentsRow = ({
    documentsState,
    onRetry,
    onVerify,
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
            pendingLabel={row.labelKey ? t(row.labelKey) : undefined}
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
            {documentsState === 'preparing-slow' ? (
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
