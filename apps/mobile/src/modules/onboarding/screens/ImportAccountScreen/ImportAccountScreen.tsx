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

import { useStyles } from './styles'
import { useTheme } from '@rneui/themed'
import {
    PWButton,
    PWIcon,
    PWInput,
    PWLoadingOverlay,
    PWText,
    PWView,
} from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { KeyboardAvoidingView, ScrollView } from 'react-native'
import { useImportAccountScreen } from './useImportAccountScreen'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { ImportAccountSupportOptionsBottomSheet } from './ImportAccountSupportOptionsBottomSheet'
import { QRScannerView } from '@components/QRScannerView'
import { WordSuggestionDropdown } from './WordSuggestionDropdown'

export const ImportAccountScreen = () => {
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()
    const {
        words,
        focused,
        setFocused,
        canImport,
        processing,
        handleWordChange,
        handleImportAccount,
        mnemonicLength,
        t,
        isKeyboardVisible,
        keyboardHeight,
        isSupportOptionsVisible,
        handleOpenSupportOptions,
        handleCloseSupportOptions,
        handlePastePassphrase,
        handleScanQRCode,
        handleLearnMore,
        isQRScannerVisible,
        handleCloseQRScanner,
        handleQRScannerSuccess,
        suggestions,
        handleSelectSuggestion,
        setInputRef,
    } = useImportAccountScreen()
    const styles = useStyles({ insets, isKeyboardVisible, keyboardHeight })

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
        <PWView style={styles.mainContainer}>
            <KeyboardAvoidingView style={styles.mainContainer}>
                <ScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollView}
                    keyboardShouldPersistTaps='handled'
                >
                    <PWText variant='h1'>
                        {t('onboarding.import_account.title')}
                    </PWText>
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
                                            const offsetIndex =
                                                index + columnOffset
                                            const isFocused =
                                                focused === offsetIndex

                                            return (
                                                <PWView
                                                    style={
                                                        isFocused
                                                            ? styles.focusedInputContainerRow
                                                            : styles.inputContainerRow
                                                    }
                                                    key={`wordinput-${offsetIndex}`}
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
                                                            ref={ref =>
                                                                setInputRef(
                                                                    offsetIndex,
                                                                    ref,
                                                                )
                                                            }
                                                            containerStyle={
                                                                styles.inputOuterContainer
                                                            }
                                                            inputContainerStyle={
                                                                isFocused
                                                                    ? styles.focusedInputContainer
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
                                                            autoFocus={
                                                                column === 0 &&
                                                                index === 0
                                                            }
                                                            autoCapitalize='none'
                                                            autoCorrect={false}
                                                        />
                                                        {isFocused && (
                                                            <WordSuggestionDropdown
                                                                suggestions={
                                                                    suggestions
                                                                }
                                                                onSelectSuggestion={
                                                                    handleSelectSuggestion
                                                                }
                                                            />
                                                        )}
                                                    </PWView>
                                                </PWView>
                                            )
                                        })}
                                </PWView>
                            )
                        })}
                    </PWView>
                </ScrollView>

                <PWView style={styles.footer}>
                    <PWButton
                        variant='primary'
                        title={t('onboarding.import_account.button')}
                        onPress={handleImportAccount}
                        isDisabled={!canImport}
                    />
                </PWView>
            </KeyboardAvoidingView>

            <PWLoadingOverlay
                isVisible={processing}
                title={t('onboarding.import_account.importing')}
            />

            <ImportAccountSupportOptionsBottomSheet
                isVisible={isSupportOptionsVisible}
                onClose={handleCloseSupportOptions}
                onPastePassphrase={handlePastePassphrase}
                onScanQRCode={handleScanQRCode}
                onLearnMore={handleLearnMore}
            />

            <QRScannerView
                isVisible={isQRScannerVisible}
                onClose={handleCloseQRScanner}
                onSuccess={handleQRScannerSuccess}
                animationType='slide'
            />
        </PWView>
    )
}
