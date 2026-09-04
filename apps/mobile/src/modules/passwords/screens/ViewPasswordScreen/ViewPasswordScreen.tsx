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
import { ActivityIndicator } from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    PWButton,
    PWIcon,
    PWText,
    PWTouchableIcon,
    PWTouchableOpacity,
    PWView,
    PWScreen,
} from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useBottomSheet } from '@modules/bottom-sheet'
import type { SettingsStackParamsList } from '@modules/settings/routes'
import { useViewPasswordScreen } from './useViewPasswordScreen'
import { useStyles } from './styles'

export const ViewPasswordScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const route = useRoute<RouteProp<SettingsStackParamsList, 'ViewPassword'>>()
    const {
        login,
        password,
        isRevealed,
        isLoading,
        handleToggleReveal,
        handleCopy,
        handleEdit,
        handleDelete,
    } = useViewPasswordScreen(route.params.id)
    const { request: requestBottomSheet } = useBottomSheet()

    useNavigationHeader({
        title: login?.domain,
        right: (
            <PWTouchableIcon
                name='edit-pen'
                onPress={handleEdit}
                testID='view_password_edit_button'
            />
        ),
    })

    const openDeleteConfirm = useCallback(async () => {
        const confirmed = await requestBottomSheet<boolean>({
            contents: (
                <ConfirmActionContent
                    icon='trash'
                    iconVariant='error'
                    title={t('settings.passwords.delete_confirm_title')}
                    message={t('settings.passwords.delete_confirm_body')}
                    confirmLabel={t('settings.passwords.delete_action')}
                    cancelLabel={t('common.cancel.label')}
                    confirmVariant='destructive'
                    cancelVariant='secondary'
                    confirmTestID='view_password_delete_confirm_button'
                    cancelTestID='view_password_delete_cancel_button'
                />
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
        if (confirmed) await handleDelete()
    }, [requestBottomSheet, t, handleDelete])

    if (isLoading || !login) {
        return (
            <PWView
                style={styles.centered}
                testID='view_password_loading_state'
            >
                <ActivityIndicator />
            </PWView>
        )
    }

    return (
        <PWScreen
            scroll='auto'
            testID='view_password_screen'
            footer={
                <PWButton
                    onPress={() => void openDeleteConfirm()}
                    title={t('settings.passwords.delete_action')}
                    variant='destructive'
                    testID='view_password_delete_button'
                />
            }
        >
            <PWView style={styles.container}>
                <PWView>
                    <PWText
                        variant='caption'
                        style={styles.fieldLabel}
                    >
                        {t('settings.passwords.domain_label')}
                    </PWText>
                    <PWText testID='view_password_domain'>
                        {login.domain}
                    </PWText>
                </PWView>
                <PWView>
                    <PWText
                        variant='caption'
                        style={styles.fieldLabel}
                    >
                        {t('settings.passwords.username_label')}
                    </PWText>
                    <PWText testID='view_password_username'>
                        {login.username}
                    </PWText>
                </PWView>
                <PWView>
                    <PWText
                        variant='caption'
                        style={styles.fieldLabel}
                    >
                        {t('settings.passwords.password_label')}
                    </PWText>
                    <PWView style={styles.passwordRow}>
                        <PWText
                            testID='view_password_password'
                            style={styles.passwordValue}
                        >
                            {isRevealed ? password : '••••••••'}
                        </PWText>
                        <PWView style={styles.passwordActions}>
                            {/* The accessible name belongs on the touchable
                                control, not the decorative icon it wraps —
                                see PWIcon's isDecorative comment. */}
                            <PWTouchableOpacity
                                accessibilityLabel={t(
                                    isRevealed
                                        ? 'settings.passwords.hide_action'
                                        : 'settings.passwords.reveal_action',
                                )}
                                onPress={() => void handleToggleReveal()}
                                testID='view_password_reveal_button'
                            >
                                <PWIcon
                                    name='eye'
                                    variant='primary'
                                />
                            </PWTouchableOpacity>
                            <PWTouchableOpacity
                                accessibilityLabel={t(
                                    'settings.passwords.copy_action',
                                )}
                                onPress={() => void handleCopy()}
                                testID='view_password_copy_button'
                            >
                                <PWIcon
                                    name='copy'
                                    variant='primary'
                                />
                            </PWTouchableOpacity>
                        </PWView>
                    </PWView>
                </PWView>
                {login.note && (
                    <PWView>
                        <PWText
                            variant='caption'
                            style={styles.fieldLabel}
                        >
                            {t('settings.passwords.note_label')}
                        </PWText>
                        <PWText testID='view_password_note'>
                            {login.note}
                        </PWText>
                    </PWView>
                )}
            </PWView>
        </PWScreen>
    )
}
