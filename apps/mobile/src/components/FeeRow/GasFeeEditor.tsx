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
import { nativeAssetFor, toWholeUnits } from '@perawallet/wallet-core-assets'
import { PWRadioButton, PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
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
    'chainId' | 'selectedPreset' | 'onPresetChange' | 'accessory'
> & { presets: Record<FeePreset, FeePresetEstimate> }

export const GasFeeEditor = ({
    chainId,
    presets,
    selectedPreset,
    onPresetChange,
    accessory,
}: GasFeeEditorProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const asset = nativeAssetFor(chainId)

    return (
        <KeyValueRow
            testID={FEE_ROW_TEST_ID}
            title={t('send_funds.confirmation.fee')}
        >
            {FEE_PRESETS.map(preset => (
                <PWRadioButton
                    key={preset}
                    testID={`fee_preset_${preset}`}
                    isSelected={preset === selectedPreset}
                    onPress={() => onPresetChange(preset)}
                >
                    <PWView style={styles.presetRow}>
                        <PWText>{t(FEE_PRESET_LABELS[preset])}</PWText>
                        <AssetAmount
                            asset={asset}
                            showSymbol
                            ignorePrivacyMode
                            value={toWholeUnits(presets[preset].amount, asset)}
                        />
                    </PWView>
                </PWRadioButton>
            ))}
            <PWView style={styles.maxFeeRow}>
                <PWText
                    variant='caption'
                    style={styles.maxFeeLabel}
                >
                    {t('send_funds.fee.max_fee')}
                </PWText>
                <AssetAmount
                    testID='fee_preset_max'
                    asset={asset}
                    showSymbol
                    ignorePrivacyMode
                    value={toWholeUnits(
                        presets[selectedPreset].maxAmount,
                        asset,
                    )}
                />
                {accessory}
            </PWView>
        </KeyValueRow>
    )
}
