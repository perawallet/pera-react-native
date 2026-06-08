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

import { TouchableOpacity } from 'react-native'

import { PWIcon } from '../PWIcon'
import { PWView } from '../PWView'

import { CheckBox, type CheckBoxProps } from '@rneui/themed'
import {
    getCheckboxAccessibilityProps,
    getCheckboxTestProps,
} from '@utils/test-id-helper'
import { useStyles } from './styles'

export type PWCheckboxProps = {
    children?: React.ReactNode
} & CheckBoxProps

const DEFAULT_ACTIVE_OPACITY = 0.8

export const PWCheckbox = ({
    children,
    testID,
    checked,
    disabled,
    onPress,
    ...props
}: PWCheckboxProps) => {
    const styles = useStyles()

    const accessibilityProps = testID
        ? getCheckboxTestProps(testID, !!checked, disabled)
        : getCheckboxAccessibilityProps(!!checked, disabled)

    return (
        <TouchableOpacity
            {...accessibilityProps}
            onPress={onPress ?? undefined}
            disabled={disabled}
            activeOpacity={DEFAULT_ACTIVE_OPACITY}
        >
            <PWView pointerEvents='none'>
                <CheckBox
                    {...props}
                    checked={checked}
                    disabled={disabled}
                    checkedIcon={
                        <PWIcon
                            name='check'
                            variant='positive'
                        />
                    }
                    uncheckedIcon={<PWView style={styles.uncheckedIcon} />}
                >
                    {children}
                </CheckBox>
            </PWView>
        </TouchableOpacity>
    )
}
