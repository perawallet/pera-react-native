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

import { PWSwitch, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

export type FilterRowProps = {
    label: string
    description: string
    value: boolean
    onToggle: () => void
    testID: string
    disabled?: boolean
}

export const FilterRow = ({
    label,
    description,
    value,
    onToggle,
    testID,
    disabled,
}: FilterRowProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={[styles.filterRow, disabled && styles.filterRowDisabled]}
            onPress={onToggle}
            disabled={disabled}
            testID={testID}
        >
            <PWView style={styles.filterTextColumn}>
                <PWText variant='body'>{label}</PWText>
                <PWText
                    variant='caption'
                    style={styles.filterDescription}
                >
                    {description}
                </PWText>
            </PWView>
            <PWView pointerEvents='none'>
                <PWSwitch
                    value={value}
                    onValueChange={onToggle}
                    disabled={disabled}
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
