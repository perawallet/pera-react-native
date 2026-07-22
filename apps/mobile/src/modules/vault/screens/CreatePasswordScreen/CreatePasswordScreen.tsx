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
import {
    PWButton,
    PWImage,
    PWInput,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useCreatePasswordScreen } from './useCreatePasswordScreen'
import { useStyles } from './styles'

import welcomeBackground from '@assets/images/welcome-background.webp'

type CreatePasswordScreenProps = {
    onDone: () => void
}

export const CreatePasswordScreen = ({
    onDone,
}: CreatePasswordScreenProps): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        password,
        confirmation,
        isSubmitting,
        hasError,
        validationError,
        canSubmit,
        setPassword,
        setConfirmation,
        handleSubmit,
    } = useCreatePasswordScreen({ onDone })

    const passwordError =
        validationError === 'too_short'
            ? t('vault.create_password.error_too_short')
            : undefined

    const confirmError =
        validationError === 'mismatch'
            ? t('vault.create_password.error_mismatch')
            : undefined

    return (
        <>
            <PWView style={styles.imageContainer}>
                <PWImage
                    source={welcomeBackground}
                    style={styles.headerImage}
                />
            </PWView>
            <PWScreen scroll='auto'>
                <PWView style={styles.container}>
                    <PWText
                        variant='h2'
                        style={styles.title}
                    >
                        {t('vault.create_password.title')}
                    </PWText>
                    <PWText
                        variant='body'
                        style={styles.description}
                    >
                        {t('vault.create_password.description')}
                    </PWText>
                    <PWInput
                        testID='create-password-input'
                        placeholder={t(
                            'vault.create_password.password_placeholder',
                        )}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        showVisibilityToggle
                        errorMessage={passwordError}
                        renderErrorMessage={validationError === 'too_short'}
                        autoCapitalize='none'
                        autoComplete='new-password'
                    />
                    <PWInput
                        testID='create-password-confirm-input'
                        placeholder={t(
                            'vault.create_password.confirm_placeholder',
                        )}
                        value={confirmation}
                        onChangeText={setConfirmation}
                        secureTextEntry
                        showVisibilityToggle
                        errorMessage={confirmError}
                        renderErrorMessage={validationError === 'mismatch'}
                        autoCapitalize='none'
                        autoComplete='new-password'
                    />
                    {hasError && (
                        <PWText
                            testID='create-password-error'
                            variant='body'
                            style={styles.errorText}
                        >
                            {t('vault.create_password.error')}
                        </PWText>
                    )}
                    <PWButton
                        testID='create-password-submit'
                        variant='primary'
                        title={t('vault.create_password.submit_button')}
                        style={styles.submitButton}
                        isDisabled={!canSubmit}
                        isLoading={isSubmitting}
                        onPress={() => void handleSubmit()}
                    />
                </PWView>
            </PWScreen>
        </>
    )
}
