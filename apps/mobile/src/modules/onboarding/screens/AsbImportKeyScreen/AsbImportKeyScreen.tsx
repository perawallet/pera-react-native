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

import React from 'react'
import { KeyboardAvoidingView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
    PWButton,
    PWInput,
    PWLoadingOverlay,
    PWScrollView,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAsbImportKeyScreen } from './useAsbImportKeyScreen'

export const AsbImportKeyScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { t } = useLanguage()
    const {
        words,
        focused,
        canContinue,
        isProcessing,
        suggestions,
        wordCount,
        setFocused,
        handleWordChange,
        handleSelectSuggestion,
        handleContinue,
    } = useAsbImportKeyScreen()

    const wordsPerColumn = Math.ceil(wordCount / 2)

    return (
        <PWView style={styles.root}>
            <KeyboardAvoidingView style={styles.root}>
                <PWScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps='handled'
                >
                    <PWText variant='h1'>
                        {t('onboarding.asb_import.key.title')}
                    </PWText>
                    <PWText
                        variant='h4'
                        style={styles.description}
                    >
                        {t('onboarding.asb_import.key.body')}
                    </PWText>

                    <PWView style={styles.columns}>
                        {[0, 1].map(column => {
                            const offset = column * wordsPerColumn
                            return (
                                <PWView
                                    key={`column-${column}`}
                                    style={styles.column}
                                >
                                    {words
                                        .slice(offset, offset + wordsPerColumn)
                                        .map((word, idx) => {
                                            const globalIndex = offset + idx
                                            const isFocused =
                                                focused === globalIndex
                                            return (
                                                <PWView
                                                    key={globalIndex}
                                                    style={styles.row}
                                                >
                                                    <PWText
                                                        variant='h4'
                                                        style={styles.label}
                                                    >
                                                        {globalIndex + 1}
                                                    </PWText>
                                                    <PWView
                                                        style={styles.inputWrap}
                                                    >
                                                        <PWInput
                                                            testID={`asb_import_key_word_${globalIndex}`}
                                                            value={word}
                                                            onChangeText={text =>
                                                                handleWordChange(
                                                                    text,
                                                                    globalIndex,
                                                                )
                                                            }
                                                            onFocus={() =>
                                                                setFocused(
                                                                    globalIndex,
                                                                )
                                                            }
                                                            autoCapitalize='none'
                                                            autoCorrect={false}
                                                            autoFocus={
                                                                globalIndex ===
                                                                0
                                                            }
                                                            renderErrorMessage={
                                                                false
                                                            }
                                                            containerStyle={
                                                                styles.inputOuter
                                                            }
                                                            inputContainerStyle={
                                                                isFocused
                                                                    ? styles.inputContainerFocused
                                                                    : styles.inputContainer
                                                            }
                                                        />
                                                    </PWView>
                                                </PWView>
                                            )
                                        })}
                                </PWView>
                            )
                        })}
                    </PWView>

                    {suggestions.length > 0 && (
                        <PWView style={styles.suggestionsRow}>
                            {suggestions.map(s => (
                                <PWTouchableOpacity
                                    key={s}
                                    onPress={() => handleSelectSuggestion(s)}
                                    style={styles.suggestionPill}
                                    testID={`asb_import_key_suggestion_${s}`}
                                >
                                    <PWText variant='h4'>{s}</PWText>
                                </PWTouchableOpacity>
                            ))}
                        </PWView>
                    )}
                </PWScrollView>

                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t('onboarding.asb_import.key.continue')}
                        onPress={handleContinue}
                        isDisabled={!canContinue}
                        testID='asb_import_key_continue_button'
                    />
                </PWView>
            </KeyboardAvoidingView>

            <PWLoadingOverlay
                isVisible={isProcessing}
                title={t('onboarding.asb_import.key.decrypting')}
            />
        </PWView>
    )
}
