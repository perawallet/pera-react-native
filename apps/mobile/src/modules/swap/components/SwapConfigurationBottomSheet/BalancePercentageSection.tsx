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
    BALANCE_PRESETS,
    MAX_BALANCE_PERCENT,
    MIN_BALANCE_PERCENT,
} from './constants'
import { useStyles } from './styles'

type BalancePercentageSectionProps = {
    text: string
    onTextChange: (text: string) => void
    isError: boolean
}

export const BalancePercentageSection = ({
    text,
    onTextChange,
    isError,
}: BalancePercentageSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const selectedValue = Number(text)

    return (
        <PWView style={styles.section}>
            <PWText
                variant='caption'
                style={styles.sectionTitle}
            >
                {t('swap.configuration.balance_percentage')}
            </PWText>
            <PWInput
                variant='body'
                value={text}
                onChangeText={onTextChange}
                keyboardType='number-pad'
                placeholder={t('swap.configuration.balance_custom_hint')}
                containerStyle={styles.inputContainer}
                inputContainerStyle={styles.inputInnerContainer}
                inputStyle={styles.input}
                renderErrorMessage={false}
                testID='swap-config-balance-input'
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
                        {t('swap.configuration.balance_error', {
                            min: MIN_BALANCE_PERCENT,
                            max: MAX_BALANCE_PERCENT,
                        })}
                    </PWText>
                </PWView>
            )}
            <PWView style={styles.chipRow}>
                {BALANCE_PRESETS.map(preset => {
                    const label =
                        preset === 100
                            ? t('swap.configuration.max')
                            : `${preset}%`
                    return (
                        <ConfigurationChip
                            key={preset}
                            label={label}
                            isSelected={selectedValue === preset}
                            onPress={() => onTextChange(String(preset))}
                            testID={`swap-config-balance-chip-${preset}`}
                        />
                    )
                })}
            </PWView>
        </PWView>
    )
}
