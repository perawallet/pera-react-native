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
    PWOverlay,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
    ActivityIndicator,
    KeyboardAvoidingView,
    ScrollView,
} from 'react-native'
import { useImportAccountScreen } from './useImportAccountScreen'
import { useAppNavigation } from '@hooks/useAppNavigation'

export const ImportAccountScreen = () => {
    const { theme } = useTheme()
    const insets = useSafeAreaInsets()
    const navigation = useAppNavigation()
    const {
        words,
        focused,
        setFocused,
        canImport,
        processing,
        updateWord,
        handleImportAccount,
        mnemonicLength,
        t,
        isKeyboardVisible,
        keyboardHeight,
    } = useImportAccountScreen()
    const styles = useStyles({ insets, isKeyboardVisible, keyboardHeight })

    const wordsPerColumn = Math.ceil(mnemonicLength / 2)

    return (
        <PWView style={styles.mainContainer}>
            <KeyboardAvoidingView style={styles.mainContainer}>
                <PWToolbar
                    left={
                        <PWIcon
                            name='chevron-left'
                            onPress={navigation.goBack}
                        />
                    }
                />

                <ScrollView
                    style={styles.scrollContainer}
                    contentContainerStyle={styles.scrollView}
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

                                            return (
                                                <PWView
                                                    style={
                                                        styles.inputContainerRow
                                                    }
                                                    key={`wordinput-${offsetIndex}`}
                                                >
                                                    <PWText
                                                        variant='h4'
                                                        style={
                                                            focused ===
                                                            offsetIndex
                                                                ? styles.focusedLabel
                                                                : styles.label
                                                        }
                                                    >
                                                        {offsetIndex + 1}
                                                    </PWText>
                                                    <PWInput
                                                        containerStyle={
                                                            styles.inputOuterContainer
                                                        }
                                                        inputContainerStyle={
                                                            focused ===
                                                            offsetIndex
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
                                                            updateWord(
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
                                                        autoCorrect
                                                    />
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

            <PWOverlay
                isVisible={processing}
                overlayStyle={styles.overlay}
                backdropStyle={styles.overlayBackdrop}
            >
                <PWText>{t('onboarding.import_account.importing')}</PWText>
                <ActivityIndicator
                    size='large'
                    color={theme.colors.linkPrimary}
                />
            </PWOverlay>
        </PWView>
    )
}
