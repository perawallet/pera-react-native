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

import {
    PWButton,
    PWCodeInput,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CARD_VERIFICATION_CODE_LENGTH } from '../cardVerificationConstants'
import { useCardForgotPasswordVerifyScreen } from './useCardForgotPasswordVerifyScreen'
import { useStyles } from './styles'

export const CardForgotPasswordVerifyScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        code,
        email,
        onChangeCode,
        isValid,
        codeError,
        isSubmitting,
        secondsRemaining,
        canResend,
        handleResend,
        handleVerify,
    } = useCardForgotPasswordVerifyScreen()

    return (
        <PWScreen testID='card-forgot-password-verify'>
            <PWView style={styles.content}>
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('peraCard.forgot_password.verify_body', { email })}
                </PWText>

                <PWView style={styles.inputGroup}>
                    <PWCodeInput
                        value={code}
                        onChangeText={onChangeCode}
                        length={CARD_VERIFICATION_CODE_LENGTH}
                        onComplete={handleVerify}
                        onSubmitEditing={() => handleVerify()}
                        errorMessage={codeError}
                        autoFocus
                        accessibilityLabel={t(
                            'peraCard.forgot_password.verify_navigation_title',
                        )}
                        testID='card-forgot-password-verify-input'
                    />

                    {canResend ? (
                        <PWText
                            variant='linkPositive'
                            onPress={handleResend}
                            testID='card-forgot-password-verify-resend'
                        >
                            {t('peraCard.forgot_password.send_again')}
                        </PWText>
                    ) : (
                        <PWText
                            variant='footnoteMedium'
                            style={styles.countdownText}
                        >
                            {t('peraCard.forgot_password.send_again_in', {
                                count: secondsRemaining,
                            })}
                        </PWText>
                    )}
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('peraCard.forgot_password.verify_button')}
                    onPress={() => handleVerify()}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-forgot-password-verify-confirm'
                />
            </PWView>
        </PWScreen>
    )
}
