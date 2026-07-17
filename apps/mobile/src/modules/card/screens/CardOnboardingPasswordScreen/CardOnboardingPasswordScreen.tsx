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
import { CardConsentCheckboxRow } from '@modules/card/components/CardConsentCheckboxRow'
import { useLanguage } from '@hooks/useLanguage'
import { PasswordRequirements } from './PasswordRequirements'
import { useCardOnboardingPasswordScreen } from './useCardOnboardingPasswordScreen'
import { useStyles } from './styles'

export const CardOnboardingPasswordScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        control,
        errors,
        password,
        isValid,
        isSubmitting,
        allowMarketing,
        allowSms,
        handleToggleMarketing,
        handleToggleSms,
        handleConfirm,
    } = useCardOnboardingPasswordScreen()

    return (
        <PWScreen testID='card-onboarding-password'>
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
                                    'peraCard.create_password.password_placeholder',
                                )}
                                secureTextEntry
                                showVisibilityToggle
                                autoCapitalize='none'
                                autoCorrect={false}
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
                                    onBlur={onBlur}
                                    placeholder={t(
                                        'peraCard.create_password.confirm_placeholder',
                                    )}
                                    secureTextEntry
                                    showVisibilityToggle
                                    autoCapitalize='none'
                                    autoCorrect={false}
                                    showErrorOnBlur
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

                        <PasswordRequirements password={password} />
                    </PWView>

                    <PWView style={styles.checkboxes}>
                        {/* SMS consent is required by Baanx (gates Continue), so
                            it comes first; marketing is optional. */}
                        <CardConsentCheckboxRow
                            checked={allowSms}
                            onPress={handleToggleSms}
                            testID='card-onboarding-password-sms-checkbox'
                        >
                            {t('peraCard.create_password.sms_opt_in')}
                        </CardConsentCheckboxRow>

                        <CardConsentCheckboxRow
                            checked={allowMarketing}
                            onPress={handleToggleMarketing}
                            testID='card-onboarding-password-marketing-checkbox'
                        >
                            {t('peraCard.create_password.marketing_opt_in')}
                        </CardConsentCheckboxRow>
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
