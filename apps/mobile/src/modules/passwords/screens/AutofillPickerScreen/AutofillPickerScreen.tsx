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

import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Login } from '@perawallet/wallet-core-passwords'
import {
    PWButton,
    PWFlatList,
    PWListItem,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import {
    useAutofillPickerScreen,
    type AutofillPickerCaller,
} from './useAutofillPickerScreen'
import { useStyles } from './styles'

const keyExtractor = (login: Login) => login.id

// Tall enough that the list is worth scrolling, short enough that the caller's
// app stays visible behind the sheet — the user is being asked about that app.
const SHEET_HEIGHT_RATIO = 0.8

type AutofillPickerScreenProps = {
    caller: AutofillPickerCaller
}

export const AutofillPickerScreen = ({ caller }: AutofillPickerScreenProps) => {
    const { t } = useTranslation()
    const {
        callerText,
        hostText,
        isUnlocked,
        isUnlocking,
        logins,
        handleUnlock,
        handleSelect,
        handleCancel,
    } = useAutofillPickerScreen(caller)
    const insets = useSafeAreaInsets()
    const { height: windowHeight } = useWindowDimensions()
    const isListVisible = isUnlocked && logins.length > 0
    const styles = useStyles({
        insets,
        sheetHeight: isListVisible
            ? windowHeight * SHEET_HEIGHT_RATIO
            : undefined,
    })

    const renderItem = useCallback(
        ({ item }: { item: Login }) => (
            <PWListItem
                icon='key'
                title={item.username}
                value={item.domain}
                onPress={() => handleSelect(item.id)}
            />
        ),
        [handleSelect],
    )

    return (
        <PWView style={styles.backdrop}>
            {/* Absolutely filled and drawn before the sheet, so it catches
                taps beside the sheet without swallowing taps inside it. The
                activity stopped being a floating window, so the platform no
                longer finishes it on an outside touch — this restores that. */}
            <PWTouchableOpacity
                style={styles.scrim}
                activeOpacity={1}
                onPress={handleCancel}
                accessible={false}
            />

            <PWView style={styles.sheet}>
                <PWText variant='h4'>
                    {t('settings.passwords.autofill_picker_title')}
                </PWText>

                {/* callerText and hostText are rendered verbatim: the hook
                    sanitises both and puts the package first, and re-deriving
                    either here would undo that without any test noticing. */}
                <PWText
                    variant='caption'
                    style={styles.caller}
                >
                    {t('settings.passwords.autofill_picker_caller', {
                        caller: callerText,
                    })}
                </PWText>

                {hostText !== null && (
                    <PWText
                        variant='caption'
                        style={styles.host}
                    >
                        {t('settings.passwords.autofill_picker_host', {
                            host: hostText,
                        })}
                    </PWText>
                )}

                {isUnlocked ? (
                    logins.length === 0 ? (
                        <PWText
                            variant='caption'
                            style={styles.empty}
                        >
                            {t('settings.passwords.autofill_picker_empty')}
                        </PWText>
                    ) : (
                        <PWView style={styles.list}>
                            <PWFlatList
                                data={logins}
                                keyExtractor={keyExtractor}
                                renderItem={renderItem}
                                testID='autofill_picker_list'
                            />
                        </PWView>
                    )
                ) : (
                    <PWButton
                        variant='primary'
                        title={t(
                            'settings.passwords.autofill_picker_unlock_action',
                        )}
                        onPress={handleUnlock}
                        isLoading={isUnlocking}
                        style={styles.unlock}
                    />
                )}

                <PWButton
                    variant='secondary'
                    title={t('settings.passwords.autofill_picker_cancel')}
                    onPress={handleCancel}
                    style={styles.cancel}
                />
            </PWView>
        </PWView>
    )
}
