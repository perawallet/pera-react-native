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
import { PWView } from '@components/core'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { FundingTypeOption } from '../../components/FundingTypeOption'
import { resolveAutoFundingHint } from '../../utils/autoFundingHint'
import { StatusChecklistRow } from './StatusChecklistRow'
import { FundingTypeInfoContent } from './FundingTypeInfoContent'
import { useStyles } from './styles'

type SelectFundingTypeRowProps = {
    isFundsConnected: boolean
    selectedFundingType: FundingType
    onSelectFundingType: (type: FundingType) => void
    /** Disables the Auto option (kill-switch off, or account can't sign). */
    isAutoFundingUnavailable: boolean
    /** False when the kill-switch is off — Auto shows a "coming soon" hint. */
    isAutoFundingEnabled: boolean
    /** True when the connected account is a Ledger — Auto gets a Ledger hint. */
    isLedgerAccount: boolean
}

/** Checklist row 4 — "Select Funding Type", active once funds are connected. */
export const SelectFundingTypeRow = ({
    isFundsConnected,
    selectedFundingType,
    onSelectFundingType,
    isAutoFundingUnavailable,
    isAutoFundingEnabled,
    isLedgerAccount,
}: SelectFundingTypeRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const title = t('peraCard.setup_status.funding_type_title')

    const autoHint = resolveAutoFundingHint(t, {
        isAutoFundingEnabled,
        isAutoUnavailable: isAutoFundingUnavailable,
        isLedgerAccount,
        fallback: t('peraCard.setup_status.funding_type_limit_hint', {
            limit: formatCurrency(AUTO_FUNDING_PER_TX_LIMIT_USD, 0, 'USD'),
        }),
    })

    if (!isFundsConnected) {
        return (
            <StatusChecklistRow
                icon='buy-sell'
                iconVariant='secondary'
                isInactive
                title={title}
                testID='card-onboarding-status-funding-type'
            />
        )
    }

    return (
        <StatusChecklistRow
            icon='buy-sell'
            iconVariant='primary'
            title={title}
            titleAccessory={
                <InfoButton
                    title={t('peraCard.setup_status.funding_type_info_title')}
                >
                    <FundingTypeInfoContent />
                </InfoButton>
            }
            testID='card-onboarding-status-funding-type'
        >
            <PWView style={styles.optionsList}>
                <FundingTypeOption
                    title={t('peraCard.setup_status.funding_type_auto_title')}
                    description={t(
                        'peraCard.setup_status.funding_type_auto_description',
                    )}
                    isSelected={selectedFundingType === FundingType.Auto}
                    onPress={() => onSelectFundingType(FundingType.Auto)}
                    isDisabled={isAutoFundingUnavailable}
                    hint={autoHint}
                    testID='card-onboarding-status-funding-type-auto'
                />
                <FundingTypeOption
                    title={t('peraCard.setup_status.funding_type_manual_title')}
                    description={t(
                        'peraCard.setup_status.funding_type_manual_description',
                    )}
                    isSelected={selectedFundingType === FundingType.Manual}
                    onPress={() => onSelectFundingType(FundingType.Manual)}
                    testID='card-onboarding-status-funding-type-manual'
                />
            </PWView>
        </StatusChecklistRow>
    )
}
