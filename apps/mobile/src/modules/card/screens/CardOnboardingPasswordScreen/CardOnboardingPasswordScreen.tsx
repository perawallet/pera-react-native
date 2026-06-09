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

import { Controller } from 'react-hook-form'
import {
    PWButton,
    PWInput,
    PWScreen,
    PWText,
    PWTouchableIcon,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useCardOnboardingPasswordScreen } from './useCardOnboardingPasswordScreen'
import { useStyles } from './styles'

import type { CardOnboardingScreenProps } from '../../routes/card-onboarding/types'

export const CardOnboardingPasswordScreen = ({
    route,
}: CardOnboardingScreenProps<'CardOnboardingPassword'>) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { email, countryIso, verificationCode } = route.params
    const {
        control,
        errors,
        isValid,
        isSubmitting,
        passwordField,
        confirmPasswordField,
        handleConfirm,
    } = useCardOnboardingPasswordScreen({ email, countryIso, verificationCode })

    return (
        <PWScreen>
            <PWView style={styles.content}>
                <PWView style={styles.fields}>
                    <Controller
                        control={control}
                        name='password'
                        render={({ field: { onChange, onBlur, value } }) => (
                            <PWInput
                                value={value}
                                onChangeText={onChange}
                                onFocus={passwordField.handleFocus}
                                onBlur={() => {
                                    onBlur()
                                    passwordField.handleBlur()
                                }}
                                placeholder={t(
                                    'peraCard.create_password.password_placeholder',
                                )}
                                secureTextEntry={!passwordField.isVisible}
                                autoCapitalize='none'
                                autoCorrect={false}
                                rightIcon={
                                    passwordField.isFocused ? (
                                        <PWTouchableIcon
                                            name='eye'
                                            variant='secondary'
                                            size='md'
                                            onPress={
                                                passwordField.toggleVisibility
                                            }
                                        />
                                    ) : undefined
                                }
                                testID='card-onboarding-password-input'
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
                                    onFocus={confirmPasswordField.handleFocus}
                                    onBlur={() => {
                                        onBlur()
                                        confirmPasswordField.handleBlur()
                                    }}
                                    placeholder={t(
                                        'peraCard.create_password.confirm_placeholder',
                                    )}
                                    secureTextEntry={
                                        !confirmPasswordField.isVisible
                                    }
                                    autoCapitalize='none'
                                    autoCorrect={false}
                                    rightIcon={
                                        confirmPasswordField.isFocused ? (
                                            <PWTouchableIcon
                                                name='eye'
                                                variant='secondary'
                                                size='md'
                                                onPress={
                                                    confirmPasswordField.toggleVisibility
                                                }
                                            />
                                        ) : undefined
                                    }
                                    errorMessage={
                                        errors.confirmPassword && value
                                            ? t(
                                                  'peraCard.create_password.passwords_mismatch',
                                              )
                                            : undefined
                                    }
                                    testID='card-onboarding-confirm-password-input'
                                />
                            )}
                        />

                        <PWText
                            variant='footnoteMedium'
                            style={styles.rules}
                        >
                            {t('peraCard.create_password.rules')}
                        </PWText>
                    </PWView>
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('peraCard.create_password.confirm_button')}
                    onPress={handleConfirm}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-onboarding-password-confirm'
                />
            </PWView>
        </PWScreen>
    )
}
