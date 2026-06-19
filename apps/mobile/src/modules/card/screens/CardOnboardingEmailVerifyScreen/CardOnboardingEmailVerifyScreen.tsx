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

import {
    PWButton,
    PWCodeInput,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CARD_VERIFICATION_CODE_LENGTH } from '../cardVerificationConstants'
import { useCardOnboardingEmailVerifyScreen } from './useCardOnboardingEmailVerifyScreen'
import { useStyles } from './styles'

export const CardOnboardingEmailVerifyScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        code,
        email,
        onChangeCode,
        isValid,
        codeError,
        secondsRemaining,
        canResend,
        handleResend,
        handleConfirm,
    } = useCardOnboardingEmailVerifyScreen()

    return (
        <PWScreen testID='card-onboarding-email-verify'>
            <PWView style={styles.content}>
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('peraCard.verify_email.body', { email })}
                </PWText>

                <PWView style={styles.form}>
                    <PWView style={styles.inputGroup}>
                        <PWCodeInput
                            value={code}
                            onChangeText={onChangeCode}
                            length={CARD_VERIFICATION_CODE_LENGTH}
                            onComplete={handleConfirm}
                            onSubmitEditing={() => handleConfirm()}
                            errorMessage={codeError}
                            autoFocus
                            accessibilityLabel={t(
                                'peraCard.verify_email.navigation_title',
                            )}
                            testID='card-onboarding-verify-input'
                        />

                        {canResend ? (
                            <PWText
                                variant='linkPositive'
                                onPress={handleResend}
                                testID='card-onboarding-verify-resend'
                            >
                                {t('peraCard.verify_email.send_again')}
                            </PWText>
                        ) : (
                            <PWText
                                variant='footnoteMedium'
                                style={styles.countdownText}
                            >
                                {t('peraCard.verify_email.send_again_in', {
                                    count: secondsRemaining,
                                })}
                            </PWText>
                        )}
                    </PWView>

                    <PWButton
                        variant='primary'
                        title={t('peraCard.verify_email.confirm_button')}
                        onPress={() => handleConfirm()}
                        isDisabled={!isValid}
                        testID='card-onboarding-verify-confirm'
                    />
                </PWView>
            </PWView>
        </PWScreen>
    )
}
