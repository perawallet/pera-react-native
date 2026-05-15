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
import { KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useHeaderHeight } from '@react-navigation/elements'
import {
    PWButton,
    PWInput,
    PWLoadingOverlay,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { MnemonicSuggestionBar } from '@modules/onboarding/components/MnemonicSuggestionBar'
import { useStyles } from './styles'
import { useAsbImportKeyScreen } from './useAsbImportKeyScreen'

const SCREEN_CAPTURE_TAG = 'asb-import-key'

export const AsbImportKeyScreen = () => {
    usePreventScreenCapture(SCREEN_CAPTURE_TAG)
    const insets = useSafeAreaInsets()
    const headerHeight = useHeaderHeight()
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
            <KeyboardAvoidingView
                style={styles.root}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={headerHeight}
            >
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
                                                        style={
                                                            isFocused
                                                                ? styles.labelFocused
                                                                : styles.label
                                                        }
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
                                                            inputStyle={
                                                                styles.input
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
                </PWScrollView>

                <MnemonicSuggestionBar
                    suggestions={suggestions}
                    onSelectSuggestion={handleSelectSuggestion}
                    testIDPrefix='asb_import_key_suggestion'
                />

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
