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
import { PWText } from '../PWText'
import { PWTouchableOpacity } from '../PWTouchableOpacity'
import { PWView } from '../PWView'

import { getTestProps } from '@utils/test-id-helper'
import { useStyles } from './styles'

export type PWRadioButtonProps = {
    onPress: () => void
    title?: string
    children?: ReactNode
    isSelected: boolean
    isDisabled?: boolean
    testID?: string
    containerStyle?: StyleProp<ViewStyle>
}
export const PWRadioButton = ({
    onPress,
    title,
    children,
    isSelected,
    isDisabled = false,
    testID,
    containerStyle,
}: PWRadioButtonProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            style={[styles.row, isDisabled && styles.disabled, containerStyle]}
            {...getTestProps(testID)}
        >
            <PWView style={styles.content}>
                {children ?? <PWText>{title}</PWText>}
            </PWView>
            <PWView
                style={[
                    styles.radioContainer,
                    isSelected && styles.selectedBorder,
                ]}
                testID={testID ? `${testID}-radio` : undefined}
            >
                {isSelected && <PWView style={styles.selectedRadio} />}
            </PWView>
        </PWTouchableOpacity>
    )
}
