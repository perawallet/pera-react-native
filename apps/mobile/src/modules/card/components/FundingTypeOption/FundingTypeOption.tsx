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
import { PWRadioButton, PWText, PWView } from '@components/core'
import { useStyles } from './styles'

type FundingTypeOptionProps = {
    title: string
    description: string
    isSelected: boolean
    onPress: () => void
    isDisabled?: boolean
    /** Short note under the description, e.g. why the option is unavailable. */
    hint?: string
    testID?: string
}

/** A selectable funding-type card — a radio with a title and short description. */
export const FundingTypeOption = ({
    title,
    description,
    isSelected,
    onPress,
    isDisabled = false,
    hint,
    testID,
}: FundingTypeOptionProps) => {
    const styles = useStyles()

    return (
        <PWRadioButton
            isSelected={isSelected}
            onPress={onPress}
            isDisabled={isDisabled}
            containerStyle={[
                styles.optionCard,
                isSelected && styles.optionCardSelected,
            ]}
            testID={testID}
        >
            <PWView style={styles.optionText}>
                <PWText variant='bodyLarge'>{title}</PWText>
                <PWText
                    variant='footnoteMedium'
                    weight={400}
                    style={styles.optionDescription}
                >
                    {description}
                </PWText>
                {hint != null && (
                    <PWText
                        variant='footnoteMedium'
                        weight={400}
                        style={styles.optionHint}
                        testID={testID ? `${testID}-hint` : undefined}
                    >
                        {hint}
                    </PWText>
                )}
            </PWView>
        </PWRadioButton>
    )
}
