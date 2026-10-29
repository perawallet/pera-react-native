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

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    createAdditionalDetailsSchema,
    ESTIMATED_ANNUAL_INCOME_BANDS,
    EstimatedAnnualIncome,
    getCardApiError,
    OTHER_OCCUPATION_KEY,
    OTHER_SOURCE_OF_WEALTH_KEY,
    OnboardingStep,
    US_ISO,
    useCardStore,
    useOnboardingDetailsQuery,
    useRegistrationSettingsQuery,
    useSubmitAdditionalDetailsMutation,
    type AdditionalDetailsFormValues,
    type RegistrationOption,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'
import { type I18nKey, i18nKey } from '@perawallet/wallet-core-chain-contract'
import type { Optional, Maybe } from '@perawallet/wallet-core-shared'
import { trackEvent, CardEvent } from '@analytics'
import {
    useCardErrorToast,
    useCardOnboardingRouter,
    useCardOptionField,
    usePreselectedCountryField,
    useRepeatedCountryField,
} from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useCardScope } from '../../hooks/useCardScope'

const MAX_INCOME_COUNTRIES = 3

/** Baanx answers this while its occupation and wealth lists are still loading. */
const SERVICE_UNAVAILABLE_STATUS = 503

const ANNUAL_INCOME_LABEL_KEYS: Record<EstimatedAnnualIncome, I18nKey> = {
    [EstimatedAnnualIncome.LessThan20k]: i18nKey(
        'peraCard.additional_details.annual_income_bands.less_than_20k',
    ),
    [EstimatedAnnualIncome.Between20kAnd50k]: i18nKey(
        'peraCard.additional_details.annual_income_bands.between_20k_and_50k',
    ),
    [EstimatedAnnualIncome.Between50kAnd100k]: i18nKey(
        'peraCard.additional_details.annual_income_bands.between_50k_and_100k',
    ),
    [EstimatedAnnualIncome.MoreThan100k]: i18nKey(
        'peraCard.additional_details.annual_income_bands.more_than_100k',
    ),
}

export type UseCardOnboardingAdditionalDetailsScreenResult = {
    control: Control<AdditionalDetailsFormValues>
    errors: FieldErrors<AdditionalDetailsFormValues>
    isValid: boolean
    isSubmitting: boolean
    /** The record hasn't answered yet; the form waits so a late prefill can't overwrite typing. */
    isRecordLoading: boolean
    selectedTinCountry: Optional<SupportedCountry>
    handleSelectTinCountry: () => void
    /** The environment lists options for the field; it hides otherwise. */
    hasOccupations: boolean
    hasSourcesOfWealth: boolean
    hasBusinessSectors: boolean
    selectedOccupation: Optional<RegistrationOption>
    /** The "other" occupation was picked, so its free-text field shows. */
    isOccupationOther: boolean
    handleSelectOccupation: () => void
    selectedSourceOfWealth: Optional<RegistrationOption>
    isSourceOfWealthOther: boolean
    handleSelectSourceOfWealth: () => void
    selectedBusinessSector: Optional<RegistrationOption>
    handleSelectBusinessSector: () => void
    selectedAnnualIncome: Optional<RegistrationOption>
    handleSelectAnnualIncome: () => void
    incomeCountries: SupportedCountry[]
    hasDuplicateIncomeCountry: boolean
    canAddIncomeCountry: boolean
    handleAddIncomeCountry: () => void
    handleChangeIncomeCountry: (index: number) => void
    handleRemoveIncomeCountry: (index: number) => void
    handleConfirm: () => void
}

/**
 * The extra due-diligence step Baanx asks BoP residents for (`phase` =
 * `ADDITIONAL_DETAILS`). Option names are Baanx's own English strings.
 */
export const useCardOnboardingAdditionalDetailsScreen =
    (): UseCardOnboardingAdditionalDetailsScreenResult => {
        const scope = useCardScope()
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { goToNextStep } = useCardOnboardingRouter()
        const { errorToast } = useToast()
        const showError = useCardErrorToast({
            titleKey: i18nKey('peraCard.additional_details.error_title'),
            bodyKey: i18nKey('peraCard.additional_details.error_body'),
        })
        const onboardingId = useCardStore(state => state.onboardingId)
        const countryIso = useCardStore(state => state.countryIso)
        const submitAdditionalDetails =
            useSubmitAdditionalDetailsMutation(scope)
        const { data: settings } = useRegistrationSettingsQuery(scope)
        const { data: onboardingDetails, isLoading: isRecordLoading } =
            useOnboardingDetailsQuery(scope, { onboardingId })
        // Required until the settings say an environment lists none.
        const hasOccupations = settings ? settings.occupations.length > 0 : true
        const hasSourcesOfWealth = settings
            ? settings.sourcesOfWealth.length > 0
            : true
        const hasBusinessSectors = settings
            ? settings.businessSectors.length > 0
            : true
        const additionalDetailsSchema = useMemo(
            () =>
                createAdditionalDetailsSchema({
                    hasOccupations,
                    hasSourcesOfWealth,
                    hasBusinessSectors,
                }),
            [hasOccupations, hasSourcesOfWealth, hasBusinessSectors],
        )

        const {
            control,
            handleSubmit,
            setValue,
            watch,
            formState: { isValid, errors },
        } = useForm<AdditionalDetailsFormValues>({
            resolver: zodResolver(additionalDetailsSchema),
            mode: 'onChange',
            defaultValues: {
                tin: '',
                tinCountry: '',
                occupation: '',
                occupationOther: '',
                sourceOfWealth: '',
                sourceOfWealthOther: '',
                businessSector: '',
                estimatedAnnualIncome: '',
                incomeCountries: [],
            },
        })
        const isOccupationOther = watch('occupation') === OTHER_OCCUPATION_KEY
        const isSourceOfWealthOther =
            watch('sourceOfWealth') === OTHER_SOURCE_OF_WEALTH_KEY

        const optionSetters = useMemo(() => {
            const set =
                (
                    field:
                        | 'occupation'
                        | 'sourceOfWealth'
                        | 'businessSector'
                        | 'estimatedAnnualIncome',
                ) =>
                (option: RegistrationOption) =>
                    setValue(field, option.key, { shouldValidate: true })
            return {
                occupation: set('occupation'),
                sourceOfWealth: set('sourceOfWealth'),
                businessSector: set('businessSector'),
                estimatedAnnualIncome: set('estimatedAnnualIncome'),
            }
        }, [setValue])
        const occupation = useCardOptionField({
            list: 'occupations',
            pickerTitle: t('peraCard.additional_details.occupation_label'),
            onChange: optionSetters.occupation,
        })
        const sourceOfWealth = useCardOptionField({
            list: 'sourcesOfWealth',
            pickerTitle: t(
                'peraCard.additional_details.source_of_wealth_label',
            ),
            onChange: optionSetters.sourceOfWealth,
        })
        const businessSector = useCardOptionField({
            list: 'businessSectors',
            pickerTitle: t('peraCard.additional_details.business_sector_label'),
            onChange: optionSetters.businessSector,
        })
        const annualIncomeOptions = useMemo(
            () =>
                ESTIMATED_ANNUAL_INCOME_BANDS.map(key => ({
                    key,
                    name: t(ANNUAL_INCOME_LABEL_KEYS[key]),
                })),
            [t],
        )
        const annualIncome = useCardOptionField({
            options: annualIncomeOptions,
            pickerTitle: t('peraCard.additional_details.annual_income_label'),
            onChange: optionSetters.estimatedAnnualIncome,
        })
        // Baanx rejects a US TIN country, so a US residence is no default.
        const tinCountry = usePreselectedCountryField({
            serverIso: null,
            residenceIso: countryIso === US_ISO ? null : countryIso,
            countries: settings?.countries,
            pickerTitle: t('peraCard.additional_details.tin_country_label'),
            onChange: useCallback(
                (country: SupportedCountry) =>
                    setValue('tinCountry', country.iso3166alpha2, {
                        shouldValidate: true,
                    }),
                [setValue],
            ),
        })
        const incomeCountries = useRepeatedCountryField({
            max: MAX_INCOME_COUNTRIES,
            pickerTitle: t('peraCard.additional_details.income_country_label'),
            onChange: useCallback(
                (countries: SupportedCountry[]) =>
                    setValue(
                        'incomeCountries',
                        countries.map(country => country.iso3166alpha2),
                        { shouldValidate: true },
                    ),
                [setValue],
            ),
        })

        // One-shot: resume from what the record holds, else start the income
        // countries at the residence.
        const hasPrefilled = useRef(false)
        const setIncomeCountries = incomeCountries.setCountries
        const prefillOccupation = occupation.setSelected
        const prefillSourceOfWealth = sourceOfWealth.setSelected
        const prefillBusinessSector = businessSector.setSelected
        const prefillAnnualIncome = annualIncome.setSelected
        useEffect(() => {
            if (hasPrefilled.current || isRecordLoading) return
            if (!settings?.countries.length) return
            hasPrefilled.current = true
            const findCountry = (iso: string) =>
                settings.countries.find(
                    country => country.iso3166alpha2 === iso,
                )
            const recordCountries = (onboardingDetails?.incomeCountries ?? [])
                .map(findCountry)
                .filter(
                    (country): country is SupportedCountry =>
                        country !== undefined,
                )
                .slice(0, MAX_INCOME_COUNTRIES)
            const residence = countryIso ? findCountry(countryIso) : undefined
            if (recordCountries.length) setIncomeCountries(recordCountries)
            else if (residence) setIncomeCountries([residence])

            const prefillOption = (
                options: RegistrationOption[],
                key: Maybe<string>,
                apply: (option: RegistrationOption) => void,
            ) => {
                const option = options.find(entry => entry.key === key)
                if (option) apply(option)
            }
            prefillOption(
                settings.occupations,
                onboardingDetails?.occupation,
                prefillOccupation,
            )
            prefillOption(
                settings.sourcesOfWealth,
                onboardingDetails?.sourceOfWealth,
                prefillSourceOfWealth,
            )
            prefillOption(
                settings.businessSectors,
                onboardingDetails?.businessSector,
                prefillBusinessSector,
            )
            // A value that isn't one of the bands stays unpicked.
            prefillOption(
                annualIncomeOptions,
                onboardingDetails?.estimatedAnnualIncome,
                prefillAnnualIncome,
            )
            const texts = {
                occupationOther: onboardingDetails?.occupationOther,
                sourceOfWealthOther: onboardingDetails?.sourceOfWealthOther,
            }
            for (const [field, value] of Object.entries(texts)) {
                if (value) {
                    setValue(field as keyof typeof texts, value, {
                        shouldValidate: true,
                    })
                }
            }
        }, [
            isRecordLoading,
            settings,
            countryIso,
            onboardingDetails,
            setIncomeCountries,
            prefillOccupation,
            prefillSourceOfWealth,
            prefillBusinessSector,
            annualIncomeOptions,
            prefillAnnualIncome,
            setValue,
        ])

        const submitForm = handleSubmit(async values => {
            if (onboardingId === null) {
                errorToast(
                    t('peraCard.additional_details.error_title'),
                    t('peraCard.additional_details.error_body'),
                )
                navigation.navigate('CardOnboardingEmailVerify')
                return
            }
            try {
                const { phase } = await submitAdditionalDetails.mutateAsync({
                    onboardingId,
                    tin: values.tin,
                    tinCountry: values.tinCountry,
                    ...(values.occupation
                        ? { occupation: values.occupation }
                        : {}),
                    // Baanx refuses the free text unless "other" was picked.
                    ...(values.occupation === OTHER_OCCUPATION_KEY
                        ? { occupationOther: values.occupationOther }
                        : {}),
                    ...(values.sourceOfWealth
                        ? { sourceOfWealth: values.sourceOfWealth }
                        : {}),
                    ...(values.sourceOfWealth === OTHER_SOURCE_OF_WEALTH_KEY
                        ? { sourceOfWealthOther: values.sourceOfWealthOther }
                        : {}),
                    ...(values.businessSector
                        ? { businessSector: values.businessSector }
                        : {}),
                    estimatedAnnualIncome: values.estimatedAnnualIncome,
                    incomeCountries: values.incomeCountries,
                })
                goToNextStep({ phase, localStep: OnboardingStep.Address })
            } catch (error) {
                const apiError = await getCardApiError(error)
                if (apiError.status === SERVICE_UNAVAILABLE_STATUS) {
                    errorToast(
                        t('peraCard.additional_details.unavailable_title'),
                        t('peraCard.additional_details.unavailable_body'),
                    )
                    return
                }
                await showError(error, apiError)
            }
        })

        const handleConfirm = () => {
            trackEvent(CardEvent.CreateAdditionalDetailsContinue)
            void submitForm()
        }

        return {
            control,
            errors,
            isValid,
            isSubmitting: submitAdditionalDetails.isPending,
            isRecordLoading,
            selectedTinCountry: tinCountry.selected,
            handleSelectTinCountry: tinCountry.handleSelect,
            hasOccupations,
            hasSourcesOfWealth,
            hasBusinessSectors,
            selectedOccupation: occupation.selected,
            isOccupationOther,
            handleSelectOccupation: occupation.handleSelect,
            selectedSourceOfWealth: sourceOfWealth.selected,
            isSourceOfWealthOther,
            handleSelectSourceOfWealth: sourceOfWealth.handleSelect,
            selectedBusinessSector: businessSector.selected,
            handleSelectBusinessSector: businessSector.handleSelect,
            selectedAnnualIncome: annualIncome.selected,
            handleSelectAnnualIncome: annualIncome.handleSelect,
            incomeCountries: incomeCountries.countries,
            hasDuplicateIncomeCountry:
                errors.incomeCountries?.message === 'income-country-duplicate',
            canAddIncomeCountry: incomeCountries.canAdd,
            handleAddIncomeCountry: incomeCountries.handleAdd,
            handleChangeIncomeCountry: incomeCountries.handleChange,
            handleRemoveIncomeCountry: incomeCountries.handleRemove,
            handleConfirm,
        }
    }
