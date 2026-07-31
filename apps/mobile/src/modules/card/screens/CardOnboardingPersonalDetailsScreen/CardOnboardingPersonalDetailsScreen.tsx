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
import { formatDobInput } from '@perawallet/wallet-core-card'
import { PWButton, PWInput, PWScreen, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CardKycRequiredView } from '../../components/CardKycRequiredView'
import { CountrySelectorField } from '../../components/CountrySelectorField'
import { useCardOnboardingPersonalDetailsScreen } from './useCardOnboardingPersonalDetailsScreen'
import { useStyles } from './styles'

export const CardOnboardingPersonalDetailsScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        control,
        errors,
        isValid,
        isSubmitting,
        selectedNationality,
        isFirstNameLocked,
        isLastNameLocked,
        isDateOfBirthLocked,
        isNationalityLocked,
        isKycRequired,
        handleVerifyIdentity,
        handleSelectNationality,
        handleConfirm,
    } = useCardOnboardingPersonalDetailsScreen()

    // Baanx refuses this step until the identity check is far enough along, so
    // the form is replaced rather than shown unsubmittable.
    if (isKycRequired) {
        return <CardKycRequiredView onVerify={handleVerifyIdentity} />
    }

    return (
        <PWScreen testID='card-onboarding-personal-details'>
            <PWView style={styles.content}>
                <PWView style={styles.fields}>
                    <Controller
                        control={control}
                        name='firstName'
                        render={({
                            field: { onChange, onBlur, value },
                            fieldState: { error },
                        }) => (
                            <PWInput
                                label={t(
                                    'peraCard.personal_details.first_name_label',
                                )}
                                labelStyle={styles.label}
                                value={value}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                autoCapitalize='words'
                                autoCorrect={false}
                                returnKeyType='next'
                                isDisabled={isFirstNameLocked}
                                showErrorOnBlur
                                renderErrorMessage
                                errorStyle={styles.errorMessage}
                                errorMessage={
                                    error && value
                                        ? t(
                                              'peraCard.personal_details.first_name_invalid',
                                          )
                                        : undefined
                                }
                                testID='card-onboarding-first-name-input'
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name='lastName'
                        render={({
                            field: { onChange, onBlur, value },
                            fieldState: { error },
                        }) => (
                            <PWInput
                                label={t(
                                    'peraCard.personal_details.last_name_label',
                                )}
                                labelStyle={styles.label}
                                value={value}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                autoCapitalize='words'
                                autoCorrect={false}
                                returnKeyType='next'
                                isDisabled={isLastNameLocked}
                                showErrorOnBlur
                                renderErrorMessage
                                errorStyle={styles.errorMessage}
                                errorMessage={
                                    error && value
                                        ? t(
                                              'peraCard.personal_details.last_name_invalid',
                                          )
                                        : undefined
                                }
                                testID='card-onboarding-last-name-input'
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name='dateOfBirth'
                        render={({
                            field: { onChange, onBlur, value },
                            fieldState: { error },
                        }) => (
                            <PWInput
                                label={t('peraCard.personal_details.dob_label')}
                                labelStyle={styles.label}
                                value={value}
                                onChangeText={text =>
                                    onChange(formatDobInput(text))
                                }
                                onBlur={onBlur}
                                keyboardType='number-pad'
                                returnKeyType='done'
                                isDisabled={isDateOfBirthLocked}
                                onSubmitEditing={handleConfirm}
                                showErrorOnBlur
                                renderErrorMessage
                                errorStyle={styles.errorMessage}
                                errorMessage={
                                    error && value
                                        ? t(
                                              'peraCard.personal_details.dob_invalid',
                                          )
                                        : undefined
                                }
                                testID='card-onboarding-dob-input'
                            />
                        )}
                    />

                    <CountrySelectorField
                        label={t('peraCard.personal_details.nationality_label')}
                        placeholder={t(
                            'peraCard.personal_details.nationality_placeholder',
                        )}
                        country={selectedNationality}
                        onPress={handleSelectNationality}
                        disabled={isNationalityLocked}
                        errorMessage={
                            errors.countryOfNationality
                                ? t(
                                      'peraCard.personal_details.nationality_required',
                                  )
                                : undefined
                        }
                        testID='card-onboarding-nationality-field'
                    />
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('peraCard.personal_details.confirm_button')}
                    onPress={handleConfirm}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-onboarding-personal-details-confirm'
                />
            </PWView>
        </PWScreen>
    )
}
