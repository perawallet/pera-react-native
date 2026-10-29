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

import {
    FEE_PRESETS,
    type FeePreset,
    type FeePresetEstimate,
    i18nKey,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { PWRadioButton, PWText, PWView } from '@components/core'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { FeeAmount } from './FeeAmount'
import { describeFeeWait } from './feeWait'
import { FEE_ROW_TEST_ID, type FeeRowProps } from './types'
import { useStyles } from './styles'

// Record keeps this exhaustive: a new preset fails to compile until labelled.
const FEE_PRESET_LABELS: Record<FeePreset, I18nKey> = {
    slow: i18nKey('send_funds.fee.slow'),
    normal: i18nKey('send_funds.fee.normal'),
    fast: i18nKey('send_funds.fee.fast'),
}

type GasFeeEditorProps = Pick<
    FeeRowProps,
    'scope' | 'selectedPreset' | 'onPresetChange' | 'accessory'
> & { presets: Record<FeePreset, FeePresetEstimate> }

// Full width rather than a KeyValueRow: the value column there is too narrow
// for a tier, its wait and two amounts on a small screen.
export const GasFeeEditor = ({
    scope,
    presets,
    selectedPreset,
    onPresetChange,
    accessory,
}: GasFeeEditorProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView
            testID={FEE_ROW_TEST_ID}
            style={styles.section}
        >
            <PWText
                variant='bodyCompact'
                style={styles.secondaryText}
            >
                {t('send_funds.confirmation.fee')}
            </PWText>
            {FEE_PRESETS.map(preset => {
                const wait = describeFeeWait(
                    presets[preset].estimatedWaitSeconds,
                )
                return (
                    <PWRadioButton
                        key={preset}
                        testID={`fee_preset_${preset}`}
                        isSelected={preset === selectedPreset}
                        onPress={() => onPresetChange(preset)}
                    >
                        <PWView style={styles.presetRow}>
                            <PWView style={styles.presetLabel}>
                                <PWText>{t(FEE_PRESET_LABELS[preset])}</PWText>
                                <PWText
                                    variant='caption'
                                    style={styles.secondaryText}
                                    testID={`fee_preset_${preset}_wait`}
                                >
                                    {t(wait.key, wait.params)}
                                </PWText>
                            </PWView>
                            <FeeAmount
                                scope={scope}
                                amount={presets[preset].amount}
                                testID={`fee_preset_${preset}_amount`}
                            />
                        </PWView>
                    </PWRadioButton>
                )
            })}
            <PWView style={styles.maxFeeRow}>
                <PWView style={styles.maxFeeLabel}>
                    <PWText
                        variant='caption'
                        style={styles.secondaryText}
                    >
                        {t('send_funds.fee.max_fee_for_preset', {
                            preset: t(FEE_PRESET_LABELS[selectedPreset]),
                        })}
                    </PWText>
                    <InfoButton
                        testID='fee_max_info'
                        title={t('send_funds.fee.max_fee')}
                    >
                        {t('send_funds.fee.max_fee_info')}
                    </InfoButton>
                    {accessory}
                </PWView>
                <FeeAmount
                    scope={scope}
                    amount={presets[selectedPreset].maxAmount}
                    testID='fee_preset_max'
                />
            </PWView>
        </PWView>
    )
}
