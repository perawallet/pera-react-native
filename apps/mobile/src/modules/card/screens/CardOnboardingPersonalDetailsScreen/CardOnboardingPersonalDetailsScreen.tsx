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
import { formatDobInput, formatSsnInput } from '@perawallet/wallet-core-card'
import {
    PWButton,
    PWInput,
    PWScreen,
    PWSkeleton,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CardConsentCheckboxRow } from '../../components/CardConsentCheckboxRow'
import { CountrySelectorField } from '../../components/CountrySelectorField'
import { OptionSelectorField } from '../../components/OptionSelectorField'
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
        isRecordLoading,
        isUsResident,
        handleSelectNationality,
        selectedBirthCountry,
        isBirthCountryLocked,
        handleSelectBirthCountry,
        additionalNationalities,
        canAddNationality,
        handleAddNationality,
        handleChangeAdditionalNationality,
        handleRemoveAdditionalNationality,
        hasEmploymentStatuses,
        hasEmploymentSectors,
        selectedEmploymentStatus,
        handleSelectEmploymentStatus,
        selectedEmploymentSector,
        handleSelectEmploymentSector,
        isPortugalResident,
        isPortugalInvestmentScheme,
        handleTogglePortugalInvestmentScheme,
        handleConfirm,
    } = useCardOnboardingPersonalDetailsScreen()

    if (isRecordLoading) {
        return (
            <PWScreen testID='card-onboarding-personal-details-loading'>
                <PWView style={styles.content}>
                    <PWView style={styles.fields}>
                        <PWSkeleton style={styles.fieldSkeleton} />
                        <PWSkeleton style={styles.fieldSkeleton} />
                        <PWSkeleton style={styles.fieldSkeleton} />
                        <PWSkeleton style={styles.fieldSkeleton} />
                    </PWView>
                </PWView>
            </PWScreen>
        )
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
                        name='middleName'
                        render={({
                            field: { onChange, onBlur, value },
                            fieldState: { error },
                        }) => (
                            <PWInput
                                label={t(
                                    'peraCard.personal_details.middle_name_label',
                                )}
                                labelStyle={styles.label}
                                value={value}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                autoCapitalize='words'
                                autoCorrect={false}
                                returnKeyType='next'
                                showErrorOnBlur
                                renderErrorMessage
                                errorStyle={styles.errorMessage}
                                errorMessage={
                                    error && value
                                        ? t(
                                              'peraCard.personal_details.middle_name_invalid',
                                          )
                                        : undefined
                                }
                                testID='card-onboarding-middle-name-input'
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

                    {isUsResident && (
                        <Controller
                            control={control}
                            name='ssn'
                            render={({
                                field: { onChange, onBlur, value },
                                fieldState: { error },
                            }) => (
                                <PWInput
                                    label={t(
                                        'peraCard.personal_details.ssn_label',
                                    )}
                                    labelStyle={styles.label}
                                    value={value}
                                    onChangeText={text =>
                                        onChange(formatSsnInput(text))
                                    }
                                    onBlur={onBlur}
                                    keyboardType='number-pad'
                                    returnKeyType='done'
                                    autoCorrect={false}
                                    showErrorOnBlur
                                    renderErrorMessage
                                    errorStyle={styles.errorMessage}
                                    errorMessage={
                                        error && value
                                            ? t(
                                                  'peraCard.personal_details.ssn_invalid',
                                              )
                                            : undefined
                                    }
                                    testID='card-onboarding-ssn-input'
                                />
                            )}
                        />
                    )}

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

                    {additionalNationalities.map((country, index) => (
                        <PWView key={`${country.iso3166alpha2}-${index}`}>
                            <CountrySelectorField
                                label={t(
                                    'peraCard.personal_details.additional_nationality_label',
                                )}
                                placeholder={t(
                                    'peraCard.personal_details.nationality_placeholder',
                                )}
                                country={country}
                                onPress={() =>
                                    handleChangeAdditionalNationality(index)
                                }
                                testID={`card-onboarding-additional-nationality-field-${index}`}
                            />
                            <PWText
                                variant='linkPositive'
                                onPress={() =>
                                    handleRemoveAdditionalNationality(index)
                                }
                                style={styles.inlineLink}
                                testID={`card-onboarding-remove-nationality-${index}`}
                            >
                                {t(
                                    'peraCard.personal_details.remove_nationality',
                                )}
                            </PWText>
                        </PWView>
                    ))}

                    {errors.additionalNationalities ? (
                        <PWText
                            variant='footnoteMedium'
                            style={styles.fieldError}
                            testID='card-onboarding-additional-nationality-error'
                        >
                            {t(
                                'peraCard.personal_details.additional_nationality_duplicate',
                            )}
                        </PWText>
                    ) : null}

                    {canAddNationality ? (
                        <PWText
                            variant='linkPositive'
                            onPress={handleAddNationality}
                            style={styles.inlineLink}
                            testID='card-onboarding-add-nationality'
                        >
                            {t('peraCard.personal_details.add_nationality')}
                        </PWText>
                    ) : null}

                    <CountrySelectorField
                        label={t(
                            'peraCard.personal_details.birth_country_label',
                        )}
                        placeholder={t(
                            'peraCard.personal_details.birth_country_placeholder',
                        )}
                        country={selectedBirthCountry}
                        onPress={handleSelectBirthCountry}
                        disabled={isBirthCountryLocked}
                        errorMessage={
                            errors.countryOfBirth
                                ? t(
                                      'peraCard.personal_details.birth_country_required',
                                  )
                                : undefined
                        }
                        testID='card-onboarding-birth-country-field'
                    />

                    {hasEmploymentStatuses ? (
                        <OptionSelectorField
                            label={t(
                                'peraCard.personal_details.employment_status_label',
                            )}
                            placeholder={t(
                                'peraCard.personal_details.option_placeholder',
                            )}
                            value={selectedEmploymentStatus?.name}
                            onPress={handleSelectEmploymentStatus}
                            testID='card-onboarding-employment-status-field'
                        />
                    ) : null}

                    {hasEmploymentSectors ? (
                        <OptionSelectorField
                            label={t(
                                'peraCard.personal_details.employment_sector_label',
                            )}
                            placeholder={t(
                                'peraCard.personal_details.option_placeholder',
                            )}
                            value={selectedEmploymentSector?.name}
                            onPress={handleSelectEmploymentSector}
                            testID='card-onboarding-employment-sector-field'
                        />
                    ) : null}

                    {isPortugalResident ? (
                        <CardConsentCheckboxRow
                            checked={isPortugalInvestmentScheme}
                            onPress={handleTogglePortugalInvestmentScheme}
                            testID='card-onboarding-portugal-scheme-checkbox'
                        >
                            {t(
                                'peraCard.personal_details.portugal_investment_scheme',
                            )}
                        </CardConsentCheckboxRow>
                    ) : null}
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
