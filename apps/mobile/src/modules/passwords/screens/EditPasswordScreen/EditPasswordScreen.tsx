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

import { useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { PWButton, PWInput, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import type { DeveloperSettingsStackParamsList } from '@modules/settings/routes'
import { useEditPasswordScreen } from './useEditPasswordScreen'
import { useStyles } from './styles'

export const EditPasswordScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const route =
        useRoute<RouteProp<DeveloperSettingsStackParamsList, 'EditPassword'>>()
    const {
        domain,
        username,
        password,
        note,
        setDomain,
        setUsername,
        setPassword,
        setNote,
        canSave,
        isLoading,
        isSaving,
        error,
        handleSave,
    } = useEditPasswordScreen(route.params.id)
    // Validation copy only appears after a save was attempted, so an empty
    // field doesn't flash an error the instant the form is prefilled.
    const [hasAttemptedSave, setHasAttemptedSave] = useState(false)

    useNavigationHeader({
        right: (
            <PWButton
                variant='linkPositive'
                title={t('settings.passwords.save_action')}
                onPress={() => {
                    setHasAttemptedSave(true)
                    void handleSave()
                }}
                isDisabled={!canSave}
                isLoading={isSaving}
                paddingStyle='none'
                testID='edit_password_save_button'
            />
        ),
    })

    if (isLoading) {
        return (
            <PWView
                style={styles.centered}
                testID='edit_password_loading_state'
            >
                <ActivityIndicator />
            </PWView>
        )
    }

    return (
        <PWScreen
            scroll='auto'
            testID='edit_password_screen'
        >
            <PWView style={styles.container}>
                <PWInput
                    testID='edit_password_domain_input'
                    label={t('settings.passwords.domain_label')}
                    placeholder={t('settings.passwords.domain_placeholder')}
                    value={domain}
                    onChangeText={setDomain}
                    autoCapitalize='none'
                    autoCorrect={false}
                    errorMessage={t('settings.passwords.domain_required_error')}
                    renderErrorMessage={
                        hasAttemptedSave && domain.trim() === ''
                    }
                />
                <PWInput
                    testID='edit_password_username_input'
                    label={t('settings.passwords.username_label')}
                    placeholder={t('settings.passwords.username_placeholder')}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize='none'
                    autoCorrect={false}
                />
                <PWInput
                    testID='edit_password_password_input'
                    label={t('settings.passwords.password_label')}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    showVisibilityToggle
                    autoCapitalize='none'
                    autoComplete='new-password'
                    errorMessage={t(
                        'settings.passwords.password_required_error',
                    )}
                    renderErrorMessage={hasAttemptedSave && password === ''}
                />
                <PWInput
                    testID='edit_password_note_input'
                    label={t('settings.passwords.note_label')}
                    value={note}
                    onChangeText={setNote}
                />
                {error && (
                    <PWText
                        testID='edit_password_error'
                        variant='caption'
                        style={styles.errorText}
                    >
                        {error}
                    </PWText>
                )}
            </PWView>
        </PWScreen>
    )
}
