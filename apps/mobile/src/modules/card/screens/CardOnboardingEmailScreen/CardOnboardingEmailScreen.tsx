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
import { PWButton, PWInput, PWScreen, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CountrySelectorField } from '../../components/CountrySelectorField'
import { useCardOnboardingEmailScreen } from './useCardOnboardingEmailScreen'
import { useStyles } from './styles'

export const CardOnboardingEmailScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        control,
        errors,
        isValid,
        isSubmitting,
        selectedCountry,
        handleSelectCountry,
        handleConfirm,
    } = useCardOnboardingEmailScreen()

    return (
        <PWScreen
            footer={
                <PWButton
                    variant='primary'
                    title={t('peraCard.create_account.confirm_button')}
                    onPress={handleConfirm}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-onboarding-email-confirm'
                />
            }
        >
            <PWView style={styles.content}>
                <Controller
                    control={control}
                    name='email'
                    render={({ field: { onChange, onBlur, value } }) => (
                        <PWInput
                            label={t('peraCard.create_account.email_label')}
                            labelStyle={styles.label}
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            placeholder={t(
                                'peraCard.create_account.email_placeholder',
                            )}
                            keyboardType='email-address'
                            autoCapitalize='none'
                            autoCorrect={false}
                            returnKeyType='next'
                            errorMessage={
                                errors.email && value
                                    ? t('peraCard.create_account.email_invalid')
                                    : undefined
                            }
                            testID='card-onboarding-email-input'
                        />
                    )}
                />

                <CountrySelectorField
                    label={t('peraCard.create_account.country_label')}
                    placeholder={t(
                        'peraCard.create_account.country_placeholder',
                    )}
                    country={selectedCountry}
                    onPress={handleSelectCountry}
                    testID='card-onboarding-country-field'
                />
            </PWView>
        </PWScreen>
    )
}
