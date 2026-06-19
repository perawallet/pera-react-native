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
    PWCodeInput,
    PWInput,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CARD_VERIFICATION_CODE_LENGTH } from '../cardVerificationConstants'
import { useCardSignInScreen } from './useCardSignInScreen'
import { useStyles } from './styles'

export const CardSignInScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        control,
        isValid,
        isSubmitting,
        isOtpRequired,
        otpCode,
        onChangeOtp,
        isOtpValid,
        otpError,
        secondsRemaining,
        canResend,
        handleResendOtp,
        handleSignIn,
        handleForgotPassword,
    } = useCardSignInScreen()

    return (
        <PWScreen testID='card-sign-in'>
            <PWView style={styles.content}>
                <PWView style={styles.fields}>
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
                                    'peraCard.sign_in.email_placeholder',
                                )}
                                keyboardType='email-address'
                                autoCapitalize='none'
                                autoCorrect={false}
                                returnKeyType='next'
                                showErrorOnBlur
                                renderErrorMessage
                                errorStyle={styles.errorMessage}
                                errorMessage={
                                    error && value
                                        ? t('peraCard.sign_in.email_invalid')
                                        : undefined
                                }
                                testID='card-sign-in-email-input'
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name='password'
                        render={({
                            field: { onChange, onBlur, value },
                            fieldState: { error },
                        }) => (
                            <PWInput
                                value={value}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                placeholder={t(
                                    'peraCard.sign_in.password_placeholder',
                                )}
                                secureTextEntry
                                showVisibilityToggle
                                autoCapitalize='none'
                                autoCorrect={false}
                                renderErrorMessage
                                errorStyle={styles.errorMessage}
                                errorMessage={
                                    error?.type === 'server'
                                        ? error.message
                                        : undefined
                                }
                                testID='card-sign-in-password-input'
                            />
                        )}
                    />
                </PWView>

                <PWText
                    variant='linkPositive'
                    onPress={handleForgotPassword}
                    style={styles.forgotPassword}
                    testID='card-sign-in-forgot-password'
                >
                    {t('peraCard.sign_in.forgot_password')}
                </PWText>

                {isOtpRequired ? (
                    <PWView style={styles.otpGroup}>
                        <PWText
                            variant='body'
                            style={styles.otpDescription}
                        >
                            {t('peraCard.sign_in.otp_body')}
                        </PWText>
                        <PWCodeInput
                            value={otpCode}
                            onChangeText={onChangeOtp}
                            length={CARD_VERIFICATION_CODE_LENGTH}
                            onComplete={handleSignIn}
                            onSubmitEditing={() => handleSignIn()}
                            errorMessage={otpError}
                            autoFocus
                            accessibilityLabel={t(
                                'peraCard.sign_in.navigation_title',
                            )}
                            testID='card-sign-in-otp-input'
                        />
                        {canResend ? (
                            <PWText
                                variant='linkPositive'
                                onPress={handleResendOtp}
                                testID='card-sign-in-otp-resend'
                            >
                                {t('peraCard.sign_in.send_again')}
                            </PWText>
                        ) : (
                            <PWText
                                variant='footnoteMedium'
                                style={styles.countdownText}
                            >
                                {t('peraCard.sign_in.send_again_in', {
                                    count: secondsRemaining,
                                })}
                            </PWText>
                        )}
                    </PWView>
                ) : null}

                <PWButton
                    variant='primary'
                    title={t('peraCard.sign_in.submit_button')}
                    onPress={() => handleSignIn()}
                    isDisabled={
                        !isValid ||
                        isSubmitting ||
                        (isOtpRequired && !isOtpValid)
                    }
                    isLoading={isSubmitting}
                    testID='card-sign-in-submit'
                />
            </PWView>
        </PWScreen>
    )
}
