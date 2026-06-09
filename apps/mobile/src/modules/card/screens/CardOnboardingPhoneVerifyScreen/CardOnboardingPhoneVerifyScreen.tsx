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

import { PWButton, PWInput, PWScreen, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    MOCK_VALID_VERIFICATION_CODE,
    useCardOnboardingPhoneVerifyScreen,
} from './useCardOnboardingPhoneVerifyScreen'
import { useStyles } from './styles'

export const CardOnboardingPhoneVerifyScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        code,
        onChangeCode,
        isValid,
        isWrongCode,
        isSubmitting,
        phoneDisplay,
        secondsRemaining,
        canResend,
        handleResend,
        handleConfirm,
    } = useCardOnboardingPhoneVerifyScreen()

    return (
        <PWScreen testID='card-onboarding-phone-verify'>
            <PWView style={styles.content}>
                <PWText
                    variant='body'
                    style={styles.description}
                >
                    {t('peraCard.verify_phone.body', { phone: phoneDisplay })}
                </PWText>

                <PWView style={styles.form}>
                    <PWView style={styles.inputGroup}>
                        <PWInput
                            value={code}
                            onChangeText={onChangeCode}
                            placeholder={t(
                                'peraCard.verify_phone.code_placeholder',
                            )}
                            autoCapitalize='characters'
                            autoCorrect={false}
                            returnKeyType='done'
                            onSubmitEditing={handleConfirm}
                            errorMessage={
                                isWrongCode
                                    ? t('peraCard.verify_phone.code_wrong')
                                    : undefined
                            }
                            testID='card-onboarding-phone-verify-input'
                        />

                        {canResend ? (
                            <PWText
                                variant='linkPositive'
                                onPress={handleResend}
                                testID='card-onboarding-phone-verify-resend'
                            >
                                {t('peraCard.verify_phone.send_again')}
                            </PWText>
                        ) : (
                            <PWText
                                variant='footnoteMedium'
                                style={styles.countdownText}
                            >
                                {t('peraCard.verify_phone.send_again_in', {
                                    count: secondsRemaining,
                                })}
                            </PWText>
                        )}
                    </PWView>

                    <PWButton
                        variant='primary'
                        title={t('peraCard.verify_phone.confirm_button')}
                        onPress={handleConfirm}
                        isDisabled={!isValid || isSubmitting}
                        isLoading={isSubmitting}
                        testID='card-onboarding-phone-verify-confirm'
                    />
                </PWView>

                {/* TODO(card): remove this dev hint once the real verify API is wired. */}
                <PWText
                    variant='footnoteMedium'
                    style={styles.devHint}
                >
                    {t('peraCard.verify_phone.dev_hint', {
                        code: MOCK_VALID_VERIFICATION_CODE,
                    })}
                </PWText>
            </PWView>
        </PWScreen>
    )
}
