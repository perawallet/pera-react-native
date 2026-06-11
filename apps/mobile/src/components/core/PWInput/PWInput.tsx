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
    useState,
} from 'react'
import { type TextInput, type TextInputProps } from 'react-native'
import {
    Input as RNEInput,
    type InputProps as RNEInputProps,
} from '@rneui/themed'
import { type TypographyVariant } from '@theme/typography'
import { PWTouchableIcon } from '../PWTouchableIcon'
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
    showErrorOnBlur?: boolean
    secureTextEntry?: boolean
    showVisibilityToggle?: boolean
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
            secureTextEntry,
            showVisibilityToggle = false,
            onFocus,
            onBlur,
            rightIcon,
            errorMessage,
            showErrorOnBlur = false,
            ...props
        },
        ref,
    ) => {
        const styles = useStyles({ variant })
        const inputRef = useRef<TextInput>(null)
        const [isRevealed, setIsRevealed] = useState(false)
        const [isFocused, setIsFocused] = useState(false)
        const [hasBlurred, setHasBlurred] = useState(false)

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

        // Internal focus tracking only matters for the reveal toggle, so it's
        // skipped entirely unless `showVisibilityToggle` is set.
        const handleFocus: NonNullable<RNEInputProps['onFocus']> = event => {
            if (showVisibilityToggle) setIsFocused(true)
            onFocus?.(event)
        }
        const handleBlur: NonNullable<RNEInputProps['onBlur']> = event => {
            if (showVisibilityToggle) setIsFocused(false)
            if (showErrorOnBlur) setHasBlurred(true)
            onBlur?.(event)
        }

        // The eye toggle is only shown while focused (matching the rest of the
        // app's password fields) and overrides any consumer-supplied rightIcon.
        const resolvedRightIcon =
            showVisibilityToggle && isFocused ? (
                <PWTouchableIcon
                    name='eye'
                    variant='secondary'
                    size='md'
                    onPress={() => setIsRevealed(prev => !prev)}
                    testID={testID ? `${testID}-visibility-toggle` : undefined}
                />
            ) : (
                rightIcon
            )

        // Withhold the error until the first blur when opted in.
        const resolvedErrorMessage =
            showErrorOnBlur && !hasBlurred ? undefined : errorMessage

        return (
            <RNEInput
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ref={inputRef as any}
                {...getTestProps(testID)}
                {...props}
                secureTextEntry={
                    showVisibilityToggle
                        ? secureTextEntry && !isRevealed
                        : secureTextEntry
                }
                onFocus={handleFocus}
                onBlur={handleBlur}
                rightIcon={resolvedRightIcon}
                errorMessage={resolvedErrorMessage}
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
