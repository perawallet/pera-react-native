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

import { useCallback } from 'react'
import { useTheme } from '@rneui/themed'

import { PWInput, PWText, PWView, type PWInputRef } from '@components/core'
import type { Nullable } from '@perawallet/wallet-core-shared'

import { useStyles } from './styles'

type PassphraseWordInputProps = {
    /** Zero-based position in the phrase; rendered as `index + 1`. */
    index: number
    value: string
    isFocused: boolean
    isLast: boolean
    autoFocus: boolean
    onChangeWord: (value: string, index: number) => void
    onFocusWord: (index: number) => void
    onSubmitWord: (index: number) => void
    inputRef: (ref: Nullable<PWInputRef>) => void
}

export const PassphraseWordInput = ({
    index,
    value,
    isFocused,
    isLast,
    autoFocus,
    onChangeWord,
    onFocusWord,
    onSubmitWord,
    inputRef,
}: PassphraseWordInputProps) => {
    const { theme } = useTheme()
    const styles = useStyles()

    const handleChangeText = useCallback(
        (text: string) => onChangeWord(text, index),
        [onChangeWord, index],
    )
    const handleFocus = useCallback(
        () => onFocusWord(index),
        [onFocusWord, index],
    )
    const handleSubmitEditing = useCallback(
        () => onSubmitWord(index),
        [onSubmitWord, index],
    )

    return (
        <PWView style={styles.inputContainerRow}>
            <PWText
                variant='h4'
                style={isFocused ? styles.focusedLabel : styles.label}
            >
                {index + 1}
            </PWText>
            <PWView style={styles.inputWrapper}>
                <PWInput
                    ref={inputRef}
                    testID={`cloud_backup_restore_word_input_${index}`}
                    containerStyle={styles.inputOuterContainer}
                    inputContainerStyle={
                        isFocused
                            ? styles.focusedInputContainer
                            : styles.inputContainer
                    }
                    inputStyle={styles.input}
                    renderErrorMessage={false}
                    value={value}
                    cursorColor={theme.colors.textMain}
                    onChangeText={handleChangeText}
                    onFocus={handleFocus}
                    onSubmitEditing={handleSubmitEditing}
                    returnKeyType={isLast ? 'done' : 'next'}
                    blurOnSubmit={isLast}
                    autoFocus={autoFocus}
                    autoCapitalize='none'
                    autoCorrect={false}
                />
            </PWView>
        </PWView>
    )
}
