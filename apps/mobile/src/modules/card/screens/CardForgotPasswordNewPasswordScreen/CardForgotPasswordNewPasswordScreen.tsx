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

import { Controller } from 'react-hook-form'
import { PWButton, PWInput, PWScreen, PWView } from '@components/core'
import { PasswordRequirements } from '@modules/card/components/PasswordRequirements'
import { useLanguage } from '@hooks/useLanguage'
import { useCardForgotPasswordNewPasswordScreen } from './useCardForgotPasswordNewPasswordScreen'
import { useStyles } from './styles'

export const CardForgotPasswordNewPasswordScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { control, errors, password, isValid, isSubmitting, handleConfirm } =
        useCardForgotPasswordNewPasswordScreen()

    return (
        <PWScreen testID='card-forgot-password-new-password'>
            <PWView style={styles.content}>
                <PWView style={styles.fields}>
                    <Controller
                        control={control}
                        name='password'
                        render={({ field: { onChange, onBlur, value } }) => (
                            <PWInput
                                value={value}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                placeholder={t(
                                    'peraCard.forgot_password.password_placeholder',
                                )}
                                secureTextEntry
                                showVisibilityToggle
                                autoCapitalize='none'
                                autoCorrect={false}
                                testID='card-forgot-password-password-input'
                            />
                        )}
                    />

                    <PWView style={styles.confirmGroup}>
                        <Controller
                            control={control}
                            name='confirmPassword'
                            render={({
                                field: { onChange, onBlur, value },
                            }) => (
                                <PWInput
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    placeholder={t(
                                        'peraCard.forgot_password.confirm_placeholder',
                                    )}
                                    secureTextEntry
                                    showVisibilityToggle
                                    autoCapitalize='none'
                                    autoCorrect={false}
                                    showErrorOnBlur
                                    errorMessage={
                                        errors.confirmPassword && value
                                            ? t(
                                                  'peraCard.forgot_password.passwords_mismatch',
                                              )
                                            : undefined
                                    }
                                    testID='card-forgot-password-confirm-password-input'
                                />
                            )}
                        />

                        <PasswordRequirements password={password} />
                    </PWView>
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('peraCard.forgot_password.reset_button')}
                    onPress={handleConfirm}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-forgot-password-confirm'
                />
            </PWView>
        </PWScreen>
    )
}
