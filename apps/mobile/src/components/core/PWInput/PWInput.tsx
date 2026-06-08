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

import {
    type ComponentType,
    forwardRef,
    useImperativeHandle,
    useRef,
} from 'react'
import { type TextInput, type TextInputProps } from 'react-native'
import {
    Input as RNEInput,
    type InputProps as RNEInputProps,
} from '@rneui/themed'
import { type TypographyVariant } from '@theme/typography'
import { useStyles } from './styles'
import { getTestProps } from '@utils/test-id-helper'
import {
    DEFAULT_MINIMUM_FONT_SCALE,
    MAX_FONT_SIZE_MULTIPLIER,
} from '../constants'

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
    errorStyle?: RNEInputProps['errorStyle']
    secureTextEntry?: boolean
    keyboardType?: RNEInputProps['keyboardType']
    returnKeyType?: RNEInputProps['returnKeyType']
    autoCapitalize?: RNEInputProps['autoCapitalize']
    autoComplete?: RNEInputProps['autoComplete']
    autoCorrect?: boolean
    autoFocus?: boolean
    selectTextOnFocus?: boolean
    onFocus?: RNEInputProps['onFocus']
    onBlur?: RNEInputProps['onBlur']
    containerStyle?: RNEInputProps['containerStyle']
    inputContainerStyle?: RNEInputProps['inputContainerStyle']
    inputStyle?: RNEInputProps['inputStyle']
    cursorColor?: string
    rightIcon?: RNEInputProps['rightIcon']
    rightIconContainerStyle?: RNEInputProps['rightIconContainerStyle']
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
    editable?: boolean
}

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
            numberOfLines,
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
                {...getTestProps(testID)}
                {...props}
                numberOfLines={numberOfLines}
                {...{
                    adjustsFontSizeToFit,
                    minimumFontScale: resolvedMinimumFontScale,
                    maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
                }}
                containerStyle={[styles.container, containerStyle]}
                inputContainerStyle={[
                    styles.inputContainer,
                    inputContainerStyle,
                ]}
                inputStyle={[styles.input, inputStyle]}
                labelStyle={labelStyle}
            />
        )
    },
)

PWInput.displayName = 'PWInput'
