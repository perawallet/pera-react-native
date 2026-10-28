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
import {
    PWButton,
    PWInput,
    PWScreen,
    PWSkeleton,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { CountrySelectorField } from '../../components/CountrySelectorField'
import { OptionSelectorField } from '../../components/OptionSelectorField'
import { AnnualIncomeField } from './AnnualIncomeField'
import { useCardOnboardingAdditionalDetailsScreen } from './useCardOnboardingAdditionalDetailsScreen'
import { useStyles } from './styles'

export const CardOnboardingAdditionalDetailsScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const {
        control,
        errors,
        isValid,
        isSubmitting,
        isRecordLoading,
        selectedTinCountry,
        handleSelectTinCountry,
        hasOccupations,
        hasSourcesOfWealth,
        hasBusinessSectors,
        selectedOccupation,
        isOccupationOther,
        handleSelectOccupation,
        selectedSourceOfWealth,
        isSourceOfWealthOther,
        handleSelectSourceOfWealth,
        selectedBusinessSector,
        handleSelectBusinessSector,
        incomeCountries,
        hasDuplicateIncomeCountry,
        canAddIncomeCountry,
        handleAddIncomeCountry,
        handleChangeIncomeCountry,
        handleRemoveIncomeCountry,
        handleConfirm,
    } = useCardOnboardingAdditionalDetailsScreen()

    if (isRecordLoading) {
        return (
            <PWScreen testID='card-onboarding-additional-details-loading'>
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

    const optionPlaceholder = t(
        'peraCard.additional_details.option_placeholder',
    )

    return (
        <PWScreen testID='card-onboarding-additional-details'>
            <PWView style={styles.content}>
                <PWText
                    variant='bodyLarge'
                    style={styles.body}
                >
                    {t('peraCard.additional_details.body')}
                </PWText>

                <PWView style={styles.fields}>
                    <Controller
                        control={control}
                        name='tin'
                        render={({
                            field: { onChange, onBlur, value },
                            fieldState: { error },
                        }) => (
                            <PWInput
                                label={t(
                                    'peraCard.additional_details.tin_label',
                                )}
                                labelStyle={styles.label}
                                value={value}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                autoCapitalize='characters'
                                autoCorrect={false}
                                showErrorOnBlur
                                renderErrorMessage
                                errorStyle={styles.errorMessage}
                                errorMessage={
                                    error && value
                                        ? t(
                                              'peraCard.additional_details.tin_invalid',
                                          )
                                        : undefined
                                }
                                testID='card-onboarding-tin-input'
                            />
                        )}
                    />

                    <CountrySelectorField
                        label={t(
                            'peraCard.additional_details.tin_country_label',
                        )}
                        placeholder={t(
                            'peraCard.additional_details.country_placeholder',
                        )}
                        country={selectedTinCountry}
                        onPress={handleSelectTinCountry}
                        errorMessage={
                            errors.tinCountry && selectedTinCountry
                                ? t(
                                      'peraCard.additional_details.tin_country_unsupported',
                                  )
                                : undefined
                        }
                        testID='card-onboarding-tin-country-field'
                    />

                    {hasOccupations ? (
                        <OptionSelectorField
                            label={t(
                                'peraCard.additional_details.occupation_label',
                            )}
                            placeholder={optionPlaceholder}
                            value={selectedOccupation?.name}
                            onPress={handleSelectOccupation}
                            testID='card-onboarding-occupation-field'
                        />
                    ) : null}
                    {isOccupationOther ? (
                        <Controller
                            control={control}
                            name='occupationOther'
                            render={({
                                field: { onChange, onBlur, value },
                            }) => (
                                <PWInput
                                    label={t(
                                        'peraCard.additional_details.occupation_other_label',
                                    )}
                                    labelStyle={styles.label}
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    renderErrorMessage={false}
                                    testID='card-onboarding-occupation-other-input'
                                />
                            )}
                        />
                    ) : null}

                    {hasSourcesOfWealth ? (
                        <OptionSelectorField
                            label={t(
                                'peraCard.additional_details.source_of_wealth_label',
                            )}
                            placeholder={optionPlaceholder}
                            value={selectedSourceOfWealth?.name}
                            onPress={handleSelectSourceOfWealth}
                            testID='card-onboarding-source-of-wealth-field'
                        />
                    ) : null}
                    {isSourceOfWealthOther ? (
                        <Controller
                            control={control}
                            name='sourceOfWealthOther'
                            render={({
                                field: { onChange, onBlur, value },
                            }) => (
                                <PWInput
                                    label={t(
                                        'peraCard.additional_details.source_of_wealth_other_label',
                                    )}
                                    labelStyle={styles.label}
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    renderErrorMessage={false}
                                    testID='card-onboarding-source-of-wealth-other-input'
                                />
                            )}
                        />
                    ) : null}

                    {hasBusinessSectors ? (
                        <OptionSelectorField
                            label={t(
                                'peraCard.additional_details.business_sector_label',
                            )}
                            placeholder={optionPlaceholder}
                            value={selectedBusinessSector?.name}
                            onPress={handleSelectBusinessSector}
                            testID='card-onboarding-business-sector-field'
                        />
                    ) : null}

                    <AnnualIncomeField control={control} />

                    {incomeCountries.map((country, index) => (
                        <PWView key={`${country.iso3166alpha2}-${index}`}>
                            <CountrySelectorField
                                label={t(
                                    'peraCard.additional_details.income_country_label',
                                )}
                                placeholder={t(
                                    'peraCard.additional_details.country_placeholder',
                                )}
                                country={country}
                                onPress={() => handleChangeIncomeCountry(index)}
                                testID={`card-onboarding-income-country-field-${index}`}
                            />
                            {incomeCountries.length > 1 ? (
                                <PWText
                                    variant='linkPositive'
                                    onPress={() =>
                                        handleRemoveIncomeCountry(index)
                                    }
                                    style={styles.inlineLink}
                                    testID={`card-onboarding-remove-income-country-${index}`}
                                >
                                    {t(
                                        'peraCard.additional_details.remove_country',
                                    )}
                                </PWText>
                            ) : null}
                        </PWView>
                    ))}

                    {hasDuplicateIncomeCountry ? (
                        <PWText
                            variant='footnoteMedium'
                            style={styles.fieldError}
                            testID='card-onboarding-income-country-error'
                        >
                            {t(
                                'peraCard.additional_details.income_country_duplicate',
                            )}
                        </PWText>
                    ) : null}

                    {canAddIncomeCountry ? (
                        <PWText
                            variant='linkPositive'
                            onPress={handleAddIncomeCountry}
                            style={styles.inlineLink}
                            testID='card-onboarding-add-income-country'
                        >
                            {t(
                                'peraCard.additional_details.add_income_country',
                            )}
                        </PWText>
                    ) : null}
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('peraCard.additional_details.confirm_button')}
                    onPress={handleConfirm}
                    isDisabled={!isValid || isSubmitting}
                    isLoading={isSubmitting}
                    testID='card-onboarding-additional-details-confirm'
                />
            </PWView>
        </PWScreen>
    )
}
