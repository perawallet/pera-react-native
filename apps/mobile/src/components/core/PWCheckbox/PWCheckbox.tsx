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

import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { CheckBox } from '@rneui/themed'

import { PWIcon } from '../PWIcon'
import { PWText } from '../PWText'
import { PWTouchableOpacity } from '../PWTouchableOpacity'
import { PWView } from '../PWView'
import { useStyles } from './styles'
import { usePWCheckbox } from './usePWCheckbox'

export type PWCheckboxLabelAccessibilityProps =
    | { isLabelInteractive?: false; accessibilityLabel?: never }
    | {
          /**
           * The label holds its own pressable (an inline link). The row then
           * stays a plain container so screen readers can reach the link, and
           * the box carries the checkbox, named by `accessibilityLabel`.
           */
          isLabelInteractive: true
          accessibilityLabel: string
      }

export type PWCheckboxProps = {
    isChecked: boolean
    onPress: () => void
    /**
     * A string, or a node for a custom row. The box and label are one press
     * target; a pressable nested in the label (an inline link) still takes its
     * own press.
     */
    label?: ReactNode
    boxPosition?: 'leading' | 'trailing'
    isDisabled?: boolean
    testID?: string
    /** Tags the box for automation. A tap on it still lands on the row. */
    boxTestID?: string
    style?: StyleProp<ViewStyle>
    boxStyle?: StyleProp<ViewStyle>
} & PWCheckboxLabelAccessibilityProps

export const PWCheckbox = ({
    isChecked,
    onPress,
    label,
    boxPosition = 'leading',
    isDisabled = false,
    testID,
    boxTestID,
    style,
    boxStyle,
    isLabelInteractive = false,
    accessibilityLabel,
}: PWCheckboxProps) => {
    const styles = useStyles()
    const { rowAccessibilityProps, boxAccessibilityProps } = usePWCheckbox({
        isChecked,
        isDisabled,
        isLabelInteractive,
        accessibilityLabel,
        onPress,
    })

    // RNE's CheckBox is a Pressable with its own checkbox role. Left live, it
    // would take presses on the box and be a second screen-reader and tab stop.
    const box = (
        <PWView
            pointerEvents='none'
            testID={boxTestID}
            {...boxAccessibilityProps}
        >
            <CheckBox
                checked={isChecked}
                disabled={isDisabled}
                // An explicit undefined would wipe the themed container style.
                {...(boxStyle ? { containerStyle: boxStyle } : {})}
                accessible={false}
                tabIndex={-1}
                aria-hidden
                checkedIcon={
                    <PWIcon
                        name='check'
                        variant='positive'
                    />
                }
                uncheckedIcon={<PWView style={styles.uncheckedIcon} />}
            />
        </PWView>
    )

    const isTextLabel = typeof label === 'string'
    // A node label is a custom row: its spacing comes from `style`.
    const labelNode = isTextLabel ? (
        <PWText style={styles.label}>{label}</PWText>
    ) : (
        label
    )

    return (
        <PWTouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            // A tick straight after an untick is a correction, not the
            // accidental double tap the guard exists to drop.
            allowRapidPress
            style={[styles.row, isTextLabel && styles.textRow, style]}
            testID={testID}
            {...rowAccessibilityProps}
        >
            {boxPosition === 'trailing' && labelNode}
            {box}
            {boxPosition === 'leading' && labelNode}
        </PWTouchableOpacity>
    )
}
