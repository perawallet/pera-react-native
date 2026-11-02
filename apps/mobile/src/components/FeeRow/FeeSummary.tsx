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

import type { Decimal } from 'decimal.js'
import type {
    ChainScope,
    FeePreset,
} from '@perawallet/wallet-core-chain-contract'
import { PWText, PWView } from '@components/core'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { FeeAmount } from './FeeAmount'
import { FEE_PRESET_LABELS } from './feePresetLabels'
import { useStyles } from './styles'

export type FeeSummaryProps = {
    scope: ChainScope
    /** Base units of the scope's native asset. */
    maxAmount: Decimal
    /** Base units of the scope's native asset. */
    estimate?: { preset: FeePreset; amount: Decimal }
    testID?: string
}

/** The fee as a tier, an estimate and a max, none of them editable. */
export const FeeSummary = ({
    scope,
    maxAmount,
    estimate,
    testID,
}: FeeSummaryProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            testID={testID}
            style={styles.section}
        >
            {estimate && (
                <PWView style={styles.maxFeeRow}>
                    <PWView style={styles.maxFeeLabel}>
                        <PWText
                            variant='bodyCompact'
                            style={styles.secondaryText}
                        >
                            {t('send_funds.confirmation.fee')}
                        </PWText>
                        <PWText
                            variant='caption'
                            style={styles.secondaryText}
                        >
                            {t(FEE_PRESET_LABELS[estimate.preset])}
                        </PWText>
                    </PWView>
                    <FeeAmount
                        scope={scope}
                        amount={estimate.amount}
                        testID='fee_summary_estimate'
                    />
                </PWView>
            )}
            <PWView style={styles.maxFeeRow}>
                <PWView style={styles.maxFeeLabel}>
                    <PWText
                        variant='caption'
                        style={styles.secondaryText}
                    >
                        {estimate
                            ? t('send_funds.fee.max_fee_for_preset', {
                                  preset: t(FEE_PRESET_LABELS[estimate.preset]),
                              })
                            : t('send_funds.fee.max_fee')}
                    </PWText>
                    <InfoButton
                        testID='fee_summary_max_info'
                        title={t('send_funds.fee.max_fee')}
                    >
                        {t('send_funds.fee.max_fee_info')}
                    </InfoButton>
                </PWView>
                <FeeAmount
                    scope={scope}
                    amount={maxAmount}
                    testID='fee_summary_max'
                />
            </PWView>
        </PWView>
    )
}
