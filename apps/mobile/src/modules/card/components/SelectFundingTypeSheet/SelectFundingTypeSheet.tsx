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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    AUTO_FUNDING_PER_TX_LIMIT_USD,
    FundingType,
} from '@perawallet/wallet-core-card'
import { formatCurrency } from '@perawallet/wallet-core-shared'
import { PWButton, PWText, PWView } from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { FundingTypeOption } from '../FundingTypeOption'
import { resolveAutoFundingHint } from '../../utils/autoFundingHint'
import { useSelectFundingTypeSheet } from './useSelectFundingTypeSheet'
import { useStyles } from './styles'

/** Bottom sheet for switching between Auto and Manual funding. */
export const SelectFundingTypeSheet = () => {
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const {
        selectedType,
        onSelectType,
        isAutoDisabled,
        isAutoFundingEnabled,
        isLedgerAccount,
        isPending,
        onApply,
        onClose,
    } = useSelectFundingTypeSheet()

    const limit = formatCurrency(AUTO_FUNDING_PER_TX_LIMIT_USD, 0, 'USD')

    const autoHint = resolveAutoFundingHint(t, {
        isAutoFundingEnabled,
        isAutoUnavailable: isAutoDisabled,
        isLedgerAccount,
    })

    return (
        <PWView
            style={styles.container}
            testID='card_select_funding_type_sheet'
        >
            <SheetHeader
                title={t('peraCard.account.funding_type_sheet_title')}
                showClose
                onClose={onClose}
                paddingStyle='none'
            />
            <PWText
                variant='body'
                weight={400}
                style={styles.description}
            >
                {t('peraCard.account.funding_type_sheet_description', {
                    limit,
                })}
            </PWText>
            <PWView style={styles.optionsList}>
                <FundingTypeOption
                    title={t('peraCard.setup_status.funding_type_auto_title')}
                    description={t(
                        'peraCard.setup_status.funding_type_auto_description',
                    )}
                    isSelected={selectedType === FundingType.Auto}
                    onPress={() => onSelectType(FundingType.Auto)}
                    isDisabled={isAutoDisabled}
                    hint={autoHint}
                    testID='card_funding_type_option_auto'
                />
                <FundingTypeOption
                    title={t('peraCard.setup_status.funding_type_manual_title')}
                    description={t(
                        'peraCard.setup_status.funding_type_manual_description',
                    )}
                    isSelected={selectedType === FundingType.Manual}
                    onPress={() => onSelectType(FundingType.Manual)}
                    testID='card_funding_type_option_manual'
                />
            </PWView>
            <PWButton
                variant='primary'
                title={t('peraCard.account.funding_type_apply')}
                onPress={onApply}
                isLoading={isPending}
                testID='card_funding_type_apply_button'
            />
        </PWView>
    )
}
