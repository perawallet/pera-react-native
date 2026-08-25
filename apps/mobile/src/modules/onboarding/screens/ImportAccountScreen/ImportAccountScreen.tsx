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

import { useTheme } from '@rneui/themed'

import {
    PWButton,
    PWIcon,
    PWInput,
    PWLoadingOverlay,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { ScreenHeader } from '@components/ScreenHeader'

import { useStyles } from './styles'
import { useImportAccountScreen } from './useImportAccountScreen'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { QRScannerView } from '@components/QRScannerView'
import { MnemonicSuggestionBar } from '@modules/onboarding/components/MnemonicSuggestionBar'

const SCREEN_CAPTURE_TAG = 'import-account-mnemonic'

export const ImportAccountScreen = () => {
    usePreventScreenCapture(SCREEN_CAPTURE_TAG)
    const { theme } = useTheme()
    const styles = useStyles()
    const {
        words,
        focused,
        setFocused,
        canImport,
        invalidWordIndices,
        processing,
        handleWordChange,
        handleImportAccount,
        mnemonicLength,
        titleKey,
        infoNoteKey,
        t,
        handleOpenSupportOptions,
        isQRScannerVisible,
        handleCloseQRScanner,
        handleQRScannerSuccess,
        suggestions,
        handleSelectSuggestion,
        refCallbacks,
        handleSubmitEditing,
    } = useImportAccountScreen()

    const wordsPerColumn = Math.ceil(mnemonicLength / 2)

    useNavigationHeader({
        right: (
            <PWIcon
                name='ellipsis'
                onPress={handleOpenSupportOptions}
            />
        ),
    })

    return (
        <>
            <PWScreen
                footer={
                    <>
                        <MnemonicSuggestionBar
                            suggestions={suggestions}
                            onSelectSuggestion={handleSelectSuggestion}
                            testIDPrefix='suggestion'
                        />
                        <PWButton
                            testID='import_account_import_button'
                            variant='primary'
                            title={t('onboarding.import_account.button')}
                            onPress={handleImportAccount}
                            isDisabled={!canImport}
                        />
                    </>
                }
            >
                <ScreenHeader title={t(titleKey)} />
                {infoNoteKey !== null && (
                    <PWText
                        testID='import_account_quantum_note'
                        style={styles.quantumNote}
                    >
                        {t(infoNoteKey)}
                    </PWText>
                )}
                <PWView style={styles.wordContainer}>
                    {[0, 1].map(column => {
                        const columnOffset = wordsPerColumn * column
                        return (
                            <PWView
                                style={styles.column}
                                key={`column-${columnOffset}`}
                            >
                                {words
                                    .slice(
                                        columnOffset,
                                        columnOffset + wordsPerColumn,
                                    )
                                    .map((word, index) => {
                                        const offsetIndex = index + columnOffset
                                        const isFocused =
                                            focused === offsetIndex

                                        return (
                                            <React.Fragment
                                                key={`wordinput-${offsetIndex}`}
                                            >
                                                <PWView
                                                    style={
                                                        isFocused
                                                            ? styles.focusedInputContainerRow
                                                            : styles.inputContainerRow
                                                    }
                                                >
                                                    <PWText
                                                        variant='h4'
                                                        style={
                                                            isFocused
                                                                ? styles.focusedLabel
                                                                : styles.label
                                                        }
                                                    >
                                                        {offsetIndex + 1}
                                                    </PWText>
                                                    <PWView
                                                        style={
                                                            styles.inputWrapper
                                                        }
                                                    >
                                                        <PWInput
                                                            ref={
                                                                refCallbacks[
                                                                    offsetIndex
                                                                ]
                                                            }
                                                            testID={`import_account_word_input_${offsetIndex}`}
                                                            containerStyle={
                                                                styles.inputOuterContainer
                                                            }
                                                            inputContainerStyle={
                                                                isFocused
                                                                    ? styles.focusedInputContainer
                                                                    : invalidWordIndices.has(
                                                                            offsetIndex,
                                                                        )
                                                                      ? styles.invalidInputContainer
                                                                      : styles.inputContainer
                                                            }
                                                            inputStyle={
                                                                styles.input
                                                            }
                                                            renderErrorMessage={
                                                                false
                                                            }
                                                            value={word}
                                                            cursorColor={
                                                                theme.colors
                                                                    .textMain
                                                            }
                                                            onChangeText={event =>
                                                                handleWordChange(
                                                                    event,
                                                                    offsetIndex,
                                                                )
                                                            }
                                                            onFocus={() =>
                                                                setFocused(
                                                                    offsetIndex,
                                                                )
                                                            }
                                                            onSubmitEditing={() =>
                                                                handleSubmitEditing(
                                                                    offsetIndex,
                                                                )
                                                            }
                                                            returnKeyType={
                                                                offsetIndex ===
                                                                mnemonicLength -
                                                                    1
                                                                    ? 'done'
                                                                    : 'next'
                                                            }
                                                            blurOnSubmit={
                                                                offsetIndex ===
                                                                mnemonicLength -
                                                                    1
                                                            }
                                                            autoFocus={
                                                                column === 0 &&
                                                                index === 0
                                                            }
                                                            autoCapitalize='none'
                                                            autoCorrect={false}
                                                            spellCheck={false}
                                                            autoComplete='off'
                                                            // autoCapitalize is only a hint and Samsung
                                                            // Keyboard / Gboard ignore it; visible-password
                                                            // is the one Android input type that actually
                                                            // disables capitalization and prediction.
                                                            keyboardType={
                                                                Platform.OS ===
                                                                'android'
                                                                    ? 'visible-password'
                                                                    : 'default'
                                                            }
                                                        />
                                                    </PWView>
                                                </PWView>
                                            </React.Fragment>
                                        )
                                    })}
                            </PWView>
                        )
                    })}
                </PWView>
            </PWScreen>

            <PWLoadingOverlay
                isVisible={processing}
                title={t('onboarding.import_account.importing')}
            />

            <QRScannerView
                isVisible={isQRScannerVisible}
                onClose={handleCloseQRScanner}
                onSuccess={handleQRScannerSuccess}
                animationType='slide'
                skipDeepLinkHandler
            />
        </>
    )
}
