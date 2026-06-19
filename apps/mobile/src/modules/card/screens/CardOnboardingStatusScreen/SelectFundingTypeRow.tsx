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
import { FundingType } from '@perawallet/wallet-core-card'
import { PWView } from '@components/core'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { StatusChecklistRow } from './StatusChecklistRow'
import { FundingTypeOption } from './FundingTypeOption'
import { FundingTypeInfoContent } from './FundingTypeInfoContent'
import { useStyles } from './styles'

// The funding-type options shown inline once funds are connected.
const FUNDING_TYPE_OPTIONS: {
    type: FundingType
    titleKey: string
    descriptionKey: string
    testID: string
}[] = [
    {
        type: FundingType.Auto,
        titleKey: 'peraCard.setup_status.funding_type_auto_title',
        descriptionKey: 'peraCard.setup_status.funding_type_auto_description',
        testID: 'card-onboarding-status-funding-type-auto',
    },
    {
        type: FundingType.Manual,
        titleKey: 'peraCard.setup_status.funding_type_manual_title',
        descriptionKey: 'peraCard.setup_status.funding_type_manual_description',
        testID: 'card-onboarding-status-funding-type-manual',
    },
]

type SelectFundingTypeRowProps = {
    isFundsConnected: boolean
    selectedFundingType: FundingType
    onSelectFundingType: (type: FundingType) => void
}

/** Checklist row 4 — "Select Funding Type", active once funds are connected. */
export const SelectFundingTypeRow = ({
    isFundsConnected,
    selectedFundingType,
    onSelectFundingType,
}: SelectFundingTypeRowProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const title = t('peraCard.setup_status.funding_type_title')

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
                {FUNDING_TYPE_OPTIONS.map(option => (
                    <FundingTypeOption
                        key={option.type}
                        title={t(option.titleKey)}
                        description={t(option.descriptionKey)}
                        isSelected={selectedFundingType === option.type}
                        onPress={() => onSelectFundingType(option.type)}
                        testID={option.testID}
                    />
                ))}
            </PWView>
        </StatusChecklistRow>
    )
}
