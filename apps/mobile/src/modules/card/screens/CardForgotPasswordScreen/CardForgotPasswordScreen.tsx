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
import { PWButton, PWInput, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useCardForgotPasswordScreen } from './useCardForgotPasswordScreen'
import { useStyles } from './styles'

export const CardForgotPasswordScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { control, isValid, isSubmitting, handleSendCode } =
        useCardForgotPasswordScreen()

    return (
        <PWScreen testID='card-forgot-password'>
            <PWView style={styles.content}>
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('peraCard.forgot_password.email_body')}
                </PWText>

                <Controller
                    control={control}
                    name='email'
                    render={({
                        field: { onChange, onBlur, value },
                        fieldState: { error },
                    }) => (
                        <PWInput
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder={t(
                                'peraCard.forgot_password.email_placeholder',
                            )}
                            keyboardType='email-address'
                            autoCapitalize='none'
                            autoCorrect={false}
                            returnKeyType='done'
                            showErrorOnBlur
                            renderErrorMessage
                            errorStyle={styles.errorMessage}
                            errorMessage={
                                error && value
                                    ? t(
                                          'peraCard.forgot_password.email_invalid',
                                      )
                                    : undefined
                            }
                            testID='card-forgot-password-email-input'
                        />
                    )}
                />

                <PWButton
                    variant='primary'
                    title={t('peraCard.forgot_password.send_code_button')}
                    onPress={handleSendCode}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-forgot-password-submit'
                />
            </PWView>
        </PWScreen>
    )
}
