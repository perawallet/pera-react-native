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

import { PWButton, PWText, PWView } from '@components/core'
import { useStyles } from './styles'

type ThresholdStepperProps = {
    value: number
    min: number
    max: number
    onIncrement: () => void
    onDecrement: () => void
}

export const ThresholdStepper = ({
    value,
    min,
    max,
    onIncrement,
    onDecrement,
}: ThresholdStepperProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <PWButton
                variant='helper'
                icon='minus'
                paddingStyle='none'
                onPress={onDecrement}
                allowRapidPress
                isDisabled={value <= min}
                style={styles.button}
                testID='threshold_decrement_button'
            />

            <PWView style={styles.valueContainer}>
                <PWText
                    variant='h1'
                    testID='threshold_value'
                    accessibilityLabel={String(value)}
                >
                    {value}
                </PWText>
            </PWView>

            <PWButton
                variant='helper'
                icon='plus'
                paddingStyle='none'
                onPress={onIncrement}
                allowRapidPress
                isDisabled={value >= max}
                style={styles.button}
                testID='threshold_increment_button'
            />
        </PWView>
    )
}
