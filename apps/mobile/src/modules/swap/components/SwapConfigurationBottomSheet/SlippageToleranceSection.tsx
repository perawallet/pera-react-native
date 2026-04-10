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

import { PWIcon, PWInput, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ConfigurationChip } from './ConfigurationChip'
import {
    CUSTOM_SLIPPAGE_KEY,
    MAX_SLIPPAGE,
    MIN_SLIPPAGE,
    SLIPPAGE_PRESETS,
} from './constants'
import { useStyles } from './styles'

type SlippageToleranceSectionProps = {
    text: string
    onTextChange: (text: string) => void
    isError: boolean
}

export const SlippageToleranceSection = ({
    text,
    onTextChange,
    isError,
}: SlippageToleranceSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const selectedValue = Number(text)
    const isCustomSelected =
        text.length > 0 &&
        !SLIPPAGE_PRESETS.some(preset => preset === selectedValue)

    return (
        <PWView style={styles.section}>
            <PWText
                variant='caption'
                style={styles.sectionTitle}
            >
                {t('swap.configuration.slippage_tolerance')}
            </PWText>
            <PWInput
                variant='body'
                value={text}
                onChangeText={onTextChange}
                keyboardType='decimal-pad'
                placeholder={t('swap.configuration.slippage_custom_hint')}
                containerStyle={styles.inputContainer}
                inputContainerStyle={styles.inputInnerContainer}
                inputStyle={styles.input}
                renderErrorMessage={false}
                testID='swap-config-slippage-input'
            />
            {isError && (
                <PWView style={styles.errorRow}>
                    <PWIcon
                        name='info'
                        variant='error'
                        size='sm'
                    />
                    <PWText
                        variant='caption'
                        style={styles.errorText}
                    >
                        {t('swap.configuration.slippage_error', {
                            min: MIN_SLIPPAGE,
                            max: MAX_SLIPPAGE,
                        })}
                    </PWText>
                </PWView>
            )}
            <PWView style={styles.chipRow}>
                <ConfigurationChip
                    key={CUSTOM_SLIPPAGE_KEY}
                    label={t('swap.configuration.custom')}
                    isSelected={isCustomSelected}
                    onPress={() => onTextChange('')}
                    testID='swap-config-slippage-chip-custom'
                />
                {SLIPPAGE_PRESETS.map(preset => (
                    <ConfigurationChip
                        key={preset}
                        label={`${preset}%`}
                        isSelected={
                            !isCustomSelected && selectedValue === preset
                        }
                        onPress={() => onTextChange(String(preset))}
                        testID={`swap-config-slippage-chip-${preset}`}
                    />
                ))}
            </PWView>
        </PWView>
    )
}
