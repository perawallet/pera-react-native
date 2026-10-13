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

import {
    type ComponentType,
    forwardRef,
    useCallback,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import {
    type LayoutChangeEvent,
    type TextInput,
    type TextInputProps,
} from 'react-native'
import {
    Input as RNEInput,
    type InputProps as RNEInputProps,
    useTheme,
} from '@rneui/themed'
import { getTypography, type TypographyVariant } from '@theme/typography'
import { isAndroid } from '@utils/platform'
import { PWTouchableIcon } from '../PWTouchableIcon'
import { computeFitFontSize } from './computeFitFontSize'
import { isVisibilityToggleAlwaysMounted } from './inputPlatform'
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
    spellCheck?: boolean
    /**
     * Secret words and keys: the keyboard must not learn, suggest or autofill
     * them. Sets the props {@link getSensitiveInputProps} returns; explicit
     * props passed alongside still win.
     */
    isSensitive?: boolean
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
    /**
     * Raw RN pass-through: blocks typing but leaves the field looking normal.
     * Used for fields that only *look* like inputs (e.g. a picker trigger).
     * For a genuinely locked value, prefer {@link PWInputProps.isDisabled}.
     */
    editable?: boolean
    /**
     * Locked value: not typeable AND visually dimmed, so a read-only field
     * doesn't read as editable. Wins over `editable`.
     */
    isDisabled?: boolean
}

// autoCorrect off is what stops iOS caching the text for suggestions; Android
// keyboards ignore these hints but honour `visible-password`. `ascii-capable`
// keeps iOS IMEs (Japanese, Pinyin) from composing, which can't match ASCII.
export const getSensitiveInputProps = (): Pick<
    PWInputProps,
    | 'autoCapitalize'
    | 'autoCorrect'
    | 'spellCheck'
    | 'autoComplete'
    | 'keyboardType'
> => ({
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
    autoComplete: 'off',
    keyboardType: isAndroid() ? 'visible-password' : 'ascii-capable',
})

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
            editable,
            isDisabled = false,
            isSensitive = false,
            ...props
        },
        ref,
    ) => {
        const { theme } = useTheme()
        const inputRef = useRef<TextInput>(null)
        const [isRevealed, setIsRevealed] = useState(false)
        const [isFocused, setIsFocused] = useState(false)
        const [hasBlurred, setHasBlurred] = useState(false)
        // Width measured on layout, used to shrink the font to fit. 0 until the
        // input is laid out, and only tracked when `adjustsFontSizeToFit` is on.
        const [measuredWidth, setMeasuredWidth] = useState(0)

        const resolvedMinimumFontScale =
            minimumFontScale ??
            (adjustsFontSizeToFit ? DEFAULT_MINIMUM_FONT_SCALE : undefined)

        // RN ignores `adjustsFontSizeToFit` on <TextInput> (it only works on
        // <Text>), so emulate it: measure the field and scale the font down to
        // keep the value on one line. The field width is layout-driven, not
        // content-driven, so shrinking the font won't re-trigger layout.
        const handleLayout = useCallback((event: LayoutChangeEvent) => {
            setMeasuredWidth(event.nativeEvent.layout.width)
        }, [])

        const fittedFontSize = adjustsFontSizeToFit
            ? computeFitFontSize({
                  text: props.value ?? '',
                  availableWidth: measuredWidth,
                  baseFontSize: getTypography(theme, variant).fontSize ?? 0,
                  minFontScale:
                      resolvedMinimumFontScale ?? DEFAULT_MINIMUM_FONT_SCALE,
              })
            : undefined

        const styles = useStyles({ variant, fittedFontSize })

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

        // Overrides any consumer-supplied rightIcon.
        const showToggle =
            showVisibilityToggle &&
            (isVisibilityToggleAlwaysMounted || isFocused)
        const resolvedRightIcon = showToggle ? (
            <PWTouchableIcon
                name='eye'
                variant='secondary'
                size='md'
                dismissKeyboardOnPress={false}
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
                {...(isSensitive ? getSensitiveInputProps() : undefined)}
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
                errorProps={testID ? { testID: `${testID}-error` } : undefined}
                numberOfLines={numberOfLines}
                onLayout={adjustsFontSizeToFit ? handleLayout : undefined}
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
                editable={isDisabled ? false : editable}
                inputStyle={[
                    styles.input,
                    isDisabled && styles.disabledInput,
                    inputStyle,
                ]}
                labelStyle={labelStyle}
            />
        )
    },
)

PWInput.displayName = 'PWInput'
