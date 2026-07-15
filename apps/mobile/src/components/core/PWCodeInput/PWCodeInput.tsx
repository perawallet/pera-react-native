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
    forwardRef,
    useCallback,
    useImperativeHandle,
    useRef,
    useState,
} from 'react'
import { Pressable, TextInput } from 'react-native'
import { PWText } from '../PWText'
import { PWView } from '../PWView'
import { useStyles } from './styles'

/** Default number of digit cells (typical email/SMS one-time code length). */
export const DEFAULT_CODE_LENGTH = 6

export type PWCodeInputRef = {
    focus: () => void
    blur: () => void
}

export type PWCodeInputProps = {
    value: string
    onChangeText: (text: string) => void
    /** Number of digit cells. Defaults to {@link DEFAULT_CODE_LENGTH}. */
    length?: number
    /** Shown below the cells; also turns every cell red. */
    errorMessage?: string
    autoFocus?: boolean
    editable?: boolean
    /** Fires once when the value reaches `length` (e.g. for auto-submit). */
    onComplete?: (code: string) => void
    onSubmitEditing?: () => void
    testID?: string
    accessibilityLabel?: string
}

/**
 * Segmented numeric verification-code input (OTP "digit boxes"). A single
 * hidden, transparent `TextInput` overlays `length` visible cells: it owns all
 * input/focus/accessibility and OS one-time-code autofill, while the cells are
 * decorative. Non-digits are stripped and the value is capped at `length`, so
 * pastes/autofill of a full code work in one shot.
 */
export const PWCodeInput = forwardRef<PWCodeInputRef, PWCodeInputProps>(
    (
        {
            value,
            onChangeText,
            length = DEFAULT_CODE_LENGTH,
            errorMessage,
            autoFocus,
            editable = true,
            onComplete,
            onSubmitEditing,
            testID,
            accessibilityLabel,
        },
        ref,
    ) => {
        const styles = useStyles()
        const inputRef = useRef<TextInput>(null)
        const [isFocused, setIsFocused] = useState(false)
        // Guards `onComplete` to fire once per completion, not every keystroke
        // while the value is already full.
        const hasCompletedRef = useRef(false)

        useImperativeHandle(
            ref,
            () => ({
                focus: () => inputRef.current?.focus(),
                blur: () => inputRef.current?.blur(),
            }),
            [],
        )

        const handleChangeText = useCallback(
            (raw: string) => {
                const next = raw.replace(/\D/g, '').slice(0, length)
                onChangeText(next)
                if (next.length === length) {
                    if (!hasCompletedRef.current) {
                        hasCompletedRef.current = true
                        onComplete?.(next)
                    }
                } else {
                    hasCompletedRef.current = false
                }
            },
            [length, onChangeText, onComplete],
        )

        const hasError = !!errorMessage
        const cells = Array.from({ length }, (_, index) => index)

        return (
            <PWView>
                <PWView style={styles.cellsWrap}>
                    {/* Rendered first → sits *behind* the cells. The Pressable
                        on top focuses it programmatically (tapping a transparent
                        overlay input is unreliable on-device). */}
                    <TextInput
                        ref={inputRef}
                        style={styles.hiddenInput}
                        value={value}
                        onChangeText={handleChangeText}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        keyboardType='number-pad'
                        inputMode='numeric'
                        maxLength={length}
                        textContentType='oneTimeCode'
                        autoComplete='sms-otp'
                        caretHidden
                        autoCorrect={false}
                        autoCapitalize='none'
                        autoFocus={autoFocus}
                        editable={editable}
                        returnKeyType='done'
                        onSubmitEditing={onSubmitEditing}
                        testID={testID}
                        accessibilityLabel={accessibilityLabel}
                    />

                    <Pressable
                        accessible={false}
                        onPress={() => inputRef.current?.focus()}
                    >
                        <PWView
                            style={styles.cellsRow}
                            accessibilityElementsHidden
                            importantForAccessibility='no-hide-descendants'
                        >
                            {cells.map(index => {
                                const char = value[index] ?? ''
                                const isActiveCell =
                                    isFocused &&
                                    index === value.length &&
                                    value.length < length
                                return (
                                    <PWView
                                        key={index}
                                        style={[
                                            styles.cell,
                                            (char !== '' || isActiveCell) &&
                                                styles.cellFilled,
                                            hasError && styles.cellError,
                                        ]}
                                    >
                                        <PWText
                                            variant='h3'
                                            style={styles.cellText}
                                        >
                                            {char}
                                        </PWText>
                                    </PWView>
                                )
                            })}
                        </PWView>
                    </Pressable>
                </PWView>

                <PWView style={styles.errorSlot}>
                    {hasError ? (
                        <PWView testID={testID ? `${testID}-error` : undefined}>
                            <PWText
                                variant='footnoteMedium'
                                style={styles.errorText}
                            >
                                {errorMessage}
                            </PWText>
                        </PWView>
                    ) : null}
                </PWView>
            </PWView>
        )
    },
)

PWCodeInput.displayName = 'PWCodeInput'
