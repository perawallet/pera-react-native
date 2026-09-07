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

import React from 'react'
import { Platform } from 'react-native'
import {
    PWButton,
    PWInput,
    PWLoadingOverlay,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { MnemonicSuggestionBar } from '@modules/onboarding/components/MnemonicSuggestionBar'
import { useStyles } from './styles'
import { useAsbImportKeyScreen } from './useAsbImportKeyScreen'

const SCREEN_CAPTURE_TAG = 'asb-import-key'

export const AsbImportKeyScreen = () => {
    usePreventScreenCapture(SCREEN_CAPTURE_TAG)
    const styles = useStyles()
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
        refCallbacks,
        handleSubmitEditing,
    } = useAsbImportKeyScreen()

    const wordsPerColumn = Math.ceil(wordCount / 2)

    return (
        <>
            <PWScreen
                footer={
                    <>
                        <MnemonicSuggestionBar
                            suggestions={suggestions}
                            onSelectSuggestion={handleSelectSuggestion}
                            testIDPrefix='asb_import_key_suggestion'
                        />
                        <PWButton
                            variant='primary'
                            title={t('onboarding.asb_import.key.continue')}
                            onPress={() => void handleContinue()}
                            isDisabled={!canContinue}
                            testID='asb_import_key_continue_button'
                        />
                    </>
                }
            >
                <PWView style={styles.scrollContent}>
                    <ScreenHeader
                        title={t('onboarding.asb_import.key.title')}
                        description={t('onboarding.asb_import.key.body')}
                    />

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
                                                            ref={
                                                                refCallbacks[
                                                                    globalIndex
                                                                ]
                                                            }
                                                            testID={`asb_import_key_word_${globalIndex}`}
                                                            value={word}
                                                            onChangeText={text =>
                                                                void handleWordChange(
                                                                    text,
                                                                    globalIndex,
                                                                )
                                                            }
                                                            onFocus={() =>
                                                                setFocused(
                                                                    globalIndex,
                                                                )
                                                            }
                                                            onSubmitEditing={() =>
                                                                handleSubmitEditing(
                                                                    globalIndex,
                                                                )
                                                            }
                                                            returnKeyType={
                                                                globalIndex ===
                                                                wordCount - 1
                                                                    ? 'done'
                                                                    : 'next'
                                                            }
                                                            blurOnSubmit={
                                                                globalIndex ===
                                                                wordCount - 1
                                                            }
                                                            autoCapitalize='none'
                                                            autoCorrect={false}
                                                            // Same word-slot keyboard as ImportAccountScreen;
                                                            // the rationale lives there.
                                                            keyboardType={
                                                                Platform.OS ===
                                                                'android'
                                                                    ? 'visible-password'
                                                                    : 'ascii-capable'
                                                            }
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
                </PWView>
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isProcessing}
                title={t('onboarding.asb_import.key.decrypting')}
            />
        </>
    )
}
