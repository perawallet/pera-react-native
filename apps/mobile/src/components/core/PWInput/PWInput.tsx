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

import { ComponentType, forwardRef, useImperativeHandle, useRef } from 'react'
import { TextInput, TextInputProps } from 'react-native'
import { Input as RNEInput, InputProps as RNEInputProps } from '@rneui/themed'
import { TypographyVariant } from '@theme/typography'
import { useStyles } from './styles'
import { getTestProps } from '@utils/test-id-helper'

export type PWInputRef = {
    focus: () => void
    blur: () => void
}

export type PWInputProps = {
    variant?: TypographyVariant
    value?: string
    onChangeText?: (text: string) => void
    placeholder?: string
    errorMessage?: string
    renderErrorMessage?: boolean
    secureTextEntry?: boolean
    keyboardType?: RNEInputProps['keyboardType']
    autoCapitalize?: RNEInputProps['autoCapitalize']
    autoCorrect?: boolean
    autoFocus?: boolean
    onFocus?: () => void
    onBlur?: () => void
    containerStyle?: RNEInputProps['containerStyle']
    inputContainerStyle?: RNEInputProps['inputContainerStyle']
    inputStyle?: RNEInputProps['inputStyle']
    cursorColor?: string
    rightIcon?: RNEInputProps['rightIcon']
    leftIcon?: RNEInputProps['leftIcon']
    onSubmitEditing?: () => void
    blurOnSubmit?: boolean
    label?: string
    labelStyle?: RNEInputProps['labelStyle']
    testID?: string
    placeholderTextColor?: string
    InputComponent?: ComponentType<TextInputProps>
    numberOfLines?: RNEInputProps['numberOfLines']
    adjustsFontSizeToFit?: boolean
    minimumFontScale?: number
}

const DEFAULT_MINIMUM_FONT_SCALE = 0.5

export const PWInput = forwardRef<PWInputRef, PWInputProps>(
    (
        {
            variant = 'body',
            containerStyle,
            inputContainerStyle,
            inputStyle,
            labelStyle,
            testID,
            adjustsFontSizeToFit,
            minimumFontScale,
            ...props
        },
        ref,
    ) => {
        const styles = useStyles({ variant })
        const inputRef = useRef<TextInput>(null)

        const resolvedMinimumFontScale =
            minimumFontScale ??
            (adjustsFontSizeToFit ? DEFAULT_MINIMUM_FONT_SCALE : undefined)

        useImperativeHandle(
            ref,
            () => ({
                focus: () => {
                    inputRef.current?.focus()
                },
                blur: () => {
                    inputRef.current?.blur()
                },
            }),
            [],
        )

        return (
            <RNEInput
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={inputRef as any}
                {...props}
                {...{
                    adjustsFontSizeToFit,
                    minimumFontScale: resolvedMinimumFontScale,
                }}
                {...getTestProps(testID)}
                containerStyle={[styles.container, containerStyle]}
                inputContainerStyle={[
                    styles.inputContainer,
                    inputContainerStyle,
                ]}
                inputStyle={[styles.input, inputStyle]}
                labelStyle={[styles.label, labelStyle]}
            />
        )
    },
)

PWInput.displayName = 'PWInput'
