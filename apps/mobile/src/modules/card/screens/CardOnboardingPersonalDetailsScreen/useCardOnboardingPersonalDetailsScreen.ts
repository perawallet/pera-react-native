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

import { useCallback, useMemo } from 'react'
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    getCardApiError,
    isDuplicateError,
    OnboardingStep,
    createPersonalDetailsSchema,
    US_ISO,
    useCardStore,
    useOnboardingDetailsQuery,
    useRegistrationSettingsQuery,
    useSubmitPersonalDetailsMutation,
    type PersonalDetailsFormValues,
    type RegistrationOption,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
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
import { toPersonalDetailsInput } from './toPersonalDetailsInput'
import { usePersonalDetailsPrefill } from './usePersonalDetailsPrefill'

/** ISO 3166-1 alpha-2 of Portugal; Baanx asks its residents about an investment scheme. */
const PORTUGAL_ISO = 'PT'
const MAX_ADDITIONAL_NATIONALITIES = 2

export type UseCardOnboardingPersonalDetailsScreenResult = {
    control: Control<PersonalDetailsFormValues>
    errors: FieldErrors<PersonalDetailsFormValues>
    isValid: boolean
    isSubmitting: boolean
    selectedNationality: Optional<SupportedCountry>
    /** Fields the server already has are prefilled and locked (read-only). */
    isFirstNameLocked: boolean
    isLastNameLocked: boolean
    isDateOfBirthLocked: boolean
    isNationalityLocked: boolean
    /** The form waits for the record so a late prefill can't overwrite typing. */
    isRecordLoading: boolean
    /** Baanx requires an SSN from US residents, so the field shows only for them. */
    isUsResident: boolean
    handleSelectNationality: () => void
    selectedBirthCountry: Optional<SupportedCountry>
    isBirthCountryLocked: boolean
    handleSelectBirthCountry: () => void
    /** Nationalities besides the main one, in the order they were added. */
    additionalNationalities: SupportedCountry[]
    canAddNationality: boolean
    handleAddNationality: () => void
    handleChangeAdditionalNationality: (index: number) => void
    handleRemoveAdditionalNationality: (index: number) => void
    /** The environment lists employment options; the fields hide otherwise. */
    hasEmploymentStatuses: boolean
    hasEmploymentSectors: boolean
    selectedEmploymentStatus: Optional<RegistrationOption>
    handleSelectEmploymentStatus: () => void
    selectedEmploymentSector: Optional<RegistrationOption>
    handleSelectEmploymentSector: () => void
    /** Baanx asks Portugal residents whether they take part in an investment scheme. */
    isPortugalResident: boolean
    isPortugalInvestmentScheme: boolean
    handleTogglePortugalInvestmentScheme: () => void
    handleConfirm: () => void
}

export const useCardOnboardingPersonalDetailsScreen =
    (): UseCardOnboardingPersonalDetailsScreenResult => {
        const scope = useCardScope()
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const showError = useCardErrorToast({
            titleKey: i18nKey('peraCard.personal_details.error_title'),
            bodyKey: i18nKey('peraCard.personal_details.error_body'),
        })
        const { goToNextStep } = useCardOnboardingRouter()
        const onboardingId = useCardStore(state => state.onboardingId)
        // On resume the onboarding record already holds the user's details, so
        // we prefill them and lock the fields the server has confirmed.
        const {
            data: onboardingDetails,
            isLoading: isRecordLoading,
            refetch: refetchRecord,
        } = useOnboardingDetailsQuery(scope, { onboardingId })
        // Another device or a reinstall holds no residence of its own.
        const storedCountryIso = useCardStore(state => state.countryIso)
        const countryIso =
            storedCountryIso ?? onboardingDetails?.countryOfResidence ?? null
        const isUsResident = countryIso === US_ISO
        const isPortugalResident = countryIso === PORTUGAL_ISO
        const submitPersonalDetails = useSubmitPersonalDetailsMutation(scope)
        const { data: settings } = useRegistrationSettingsQuery(scope)
        // Required until the settings say an environment lists none.
        const hasEmploymentStatuses = settings
            ? settings.employmentStatuses.length > 0
            : true
        const hasEmploymentSectors = settings
            ? settings.employmentSectors.length > 0
            : true
        const personalDetailsSchema = useMemo(
            () =>
                createPersonalDetailsSchema({
                    isUsResident,
                    hasEmploymentStatuses,
                    hasEmploymentSectors,
                }),
            [isUsResident, hasEmploymentStatuses, hasEmploymentSectors],
        )

        const {
            control,
            handleSubmit,
            setValue,
            trigger,
            watch,
            formState: { isValid, errors },
        } = useForm<PersonalDetailsFormValues>({
            resolver: zodResolver(personalDetailsSchema),
            mode: 'onChange',
            defaultValues: {
                firstName: '',
                middleName: '',
                lastName: '',
                dateOfBirth: '',
                countryOfNationality: '',
                countryOfBirth: '',
                additionalNationalities: [],
                portugalInvestmentScheme: false,
                employmentStatus: '',
                employmentSector: '',
                ssn: '',
            },
        })
        const isPortugalInvestmentScheme = watch('portugalInvestmentScheme')

        const nationality = usePreselectedCountryField({
            serverIso: onboardingDetails?.countryOfNationality ?? null,
            residenceIso: countryIso,
            countries: settings?.countries,
            pickerTitle: t(
                'peraCard.personal_details.nationality_picker_title',
            ),
            onChange: useCallback(
                (country: SupportedCountry) => {
                    setValue('countryOfNationality', country.iso3166alpha2, {
                        shouldValidate: true,
                    })
                    // The duplicate check lives on the extra nationalities, so
                    // a new main one has to re-run it there.
                    void trigger('additionalNationalities')
                },
                [setValue, trigger],
            ),
        })
        // Baanx requires the birth country for EU/UK residents; preselecting
        // the residence covers the common case with no extra tap.
        const birthCountry = usePreselectedCountryField({
            serverIso: onboardingDetails?.countryOfBirth ?? null,
            residenceIso: countryIso,
            countries: settings?.countries,
            pickerTitle: t(
                'peraCard.personal_details.birth_country_picker_title',
            ),
            onChange: useCallback(
                (country: SupportedCountry) =>
                    setValue('countryOfBirth', country.iso3166alpha2, {
                        shouldValidate: true,
                    }),
                [setValue],
            ),
        })
        const extraNationalities = useRepeatedCountryField({
            max: MAX_ADDITIONAL_NATIONALITIES,
            pickerTitle: t(
                'peraCard.personal_details.nationality_picker_title',
            ),
            onChange: useCallback(
                (countries: SupportedCountry[]) =>
                    setValue(
                        'additionalNationalities',
                        countries.map(country => country.iso3166alpha2),
                        { shouldValidate: true },
                    ),
                [setValue],
            ),
        })
        const employmentStatus = useCardOptionField({
            list: 'employmentStatuses',
            pickerTitle: t('peraCard.personal_details.employment_status_label'),
            onChange: useCallback(
                (option: RegistrationOption) =>
                    setValue('employmentStatus', option.key, {
                        shouldValidate: true,
                    }),
                [setValue],
            ),
        })
        const employmentSector = useCardOptionField({
            list: 'employmentSectors',
            pickerTitle: t('peraCard.personal_details.employment_sector_label'),
            onChange: useCallback(
                (option: RegistrationOption) =>
                    setValue('employmentSector', option.key, {
                        shouldValidate: true,
                    }),
                [setValue],
            ),
        })

        usePersonalDetailsPrefill({
            record: onboardingDetails,
            countries: settings?.countries,
            maxExtraNationalities: MAX_ADDITIONAL_NATIONALITIES,
            setValue,
            setExtraNationalities: extraNationalities.setCountries,
        })

        const handleTogglePortugalInvestmentScheme = useCallback(() => {
            setValue('portugalInvestmentScheme', !isPortugalInvestmentScheme, {
                shouldValidate: true,
            })
        }, [isPortugalInvestmentScheme, setValue])

        const submitDetails = handleSubmit(async values => {
            // Set by email/verify; if missing, re-verify rather than submit an
            // empty onboarding id.
            if (onboardingId === null) {
                errorToast(
                    t('peraCard.personal_details.error_title'),
                    t('peraCard.personal_details.error_body'),
                )
                navigation.navigate('CardOnboardingEmailVerify')
                return
            }
            try {
                const { phase } = await submitPersonalDetails.mutateAsync(
                    toPersonalDetailsInput(values, {
                        onboardingId,
                        isUsResident,
                        isPortugalResident,
                    }),
                )
                goToNextStep({ phase, localStep: OnboardingStep.Address })
            } catch (error) {
                // A duplicate means Baanx already holds these details (a
                // retried non-idempotent submit), so continue rather than
                // strand the user. Otherwise prefer Baanx's own message so the
                // real reason shows (e.g. a wrong-phase rejection).
                const apiError = await getCardApiError(error)
                if (isDuplicateError(apiError)) {
                    // The record's phase still says whether additional
                    // details are owed.
                    const { data: record } = await refetchRecord()
                    goToNextStep({
                        phase: record?.phase ?? null,
                        localStep: OnboardingStep.Address,
                    })
                    return
                }
                await showError(error, apiError)
            }
        })

        const handleConfirm = () => {
            trackEvent(CardEvent.CreateVerifyAccountContinue)
            void submitDetails()
        }

        return {
            control,
            errors,
            isValid,
            isSubmitting: submitPersonalDetails.isPending,
            selectedNationality: nationality.selected,
            isFirstNameLocked: Boolean(onboardingDetails?.firstName),
            isLastNameLocked: Boolean(onboardingDetails?.lastName),
            isDateOfBirthLocked: Boolean(onboardingDetails?.dateOfBirth),
            isNationalityLocked: nationality.isLocked,
            isRecordLoading,
            isUsResident,
            handleSelectNationality: nationality.handleSelect,
            selectedBirthCountry: birthCountry.selected,
            isBirthCountryLocked: birthCountry.isLocked,
            handleSelectBirthCountry: birthCountry.handleSelect,
            additionalNationalities: extraNationalities.countries,
            canAddNationality: extraNationalities.canAdd,
            handleAddNationality: extraNationalities.handleAdd,
            handleChangeAdditionalNationality: extraNationalities.handleChange,
            handleRemoveAdditionalNationality: extraNationalities.handleRemove,
            hasEmploymentStatuses,
            hasEmploymentSectors,
            selectedEmploymentStatus: employmentStatus.selected,
            handleSelectEmploymentStatus: employmentStatus.handleSelect,
            selectedEmploymentSector: employmentSector.selected,
            handleSelectEmploymentSector: employmentSector.handleSelect,
            isPortugalResident,
            isPortugalInvestmentScheme,
            handleTogglePortugalInvestmentScheme,
            handleConfirm,
        }
    }
