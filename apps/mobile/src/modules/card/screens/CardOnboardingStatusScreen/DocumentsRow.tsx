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
import { type IconName, type PWIconVariant } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { StatusChecklistRow } from './StatusChecklistRow'
import { type DocumentsState } from './useCardOnboardingStatusScreen'

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

type DocumentsRowProps = {
    documentsState: DocumentsState
}

/** Checklist row 1 — "Submit Your Documents", driven by the KYC state. */
export const DocumentsRow = ({ documentsState }: DocumentsRowProps) => {
    const { t } = useLanguage()
    const row = DOCUMENTS_ROW[documentsState]

    return (
        <StatusChecklistRow
            icon={row.icon}
            iconVariant={row.variant}
            pendingLabel={
                row.showsPendingLabel
                    ? t('peraCard.setup_status.documents_pending_label')
                    : undefined
            }
            title={t('peraCard.setup_status.documents_title')}
            body={t(row.bodyKey)}
            testID='card-onboarding-status-documents'
        />
    )
}
