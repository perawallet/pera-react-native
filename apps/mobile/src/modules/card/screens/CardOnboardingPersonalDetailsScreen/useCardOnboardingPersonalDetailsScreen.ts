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

import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    dobToIsoDate,
    personalDetailsSchema,
    useCardStore,
    useRegistrationSettingsQuery,
    useSubmitPersonalDetailsMutation,
    type PersonalDetailsFormValues,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '@modules/card/components/CardCountryPicker'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

import type { Optional } from '@perawallet/wallet-core-shared'

export type UseCardOnboardingPersonalDetailsScreenResult = {
    control: Control<PersonalDetailsFormValues>
    errors: FieldErrors<PersonalDetailsFormValues>
    isValid: boolean
    isSubmitting: boolean
    selectedNationality: Optional<SupportedCountry>
    handleSelectNationality: () => void
    handleConfirm: () => void
}

export const useCardOnboardingPersonalDetailsScreen =
    (): UseCardOnboardingPersonalDetailsScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const { request } = useBottomSheet()
        const onboardingId = useCardStore(state => state.onboardingId)
        const countryIso = useCardStore(state => state.countryIso)
        const submitPersonalDetails = useSubmitPersonalDetailsMutation()
        const { data: settings } = useRegistrationSettingsQuery()

        const [selectedNationality, setSelectedNationality] =
            useState<Optional<SupportedCountry>>(undefined)
        const hasPreselected = useRef(false)

        const {
            control,
            handleSubmit,
            setValue,
            formState: { isValid, errors },
        } = useForm<PersonalDetailsFormValues>({
            resolver: zodResolver(personalDetailsSchema),
            mode: 'onChange',
            defaultValues: {
                firstName: '',
                lastName: '',
                dateOfBirth: '',
                countryOfNationality: '',
            },
        })

        // Default the nationality to the residence country once settings load —
        // a sensible guess the user can override. Only fires once, and only if
        // the residence country is in the supported list; never overrides a pick.
        useEffect(() => {
            if (hasPreselected.current || selectedNationality) return
            if (!countryIso || !settings?.countries.length) return
            const match = settings.countries.find(
                country => country.iso3166alpha2 === countryIso,
            )
            if (!match) return
            hasPreselected.current = true
            setSelectedNationality(match)
            setValue('countryOfNationality', match.iso3166alpha2, {
                shouldValidate: true,
            })
        }, [countryIso, settings, selectedNationality, setValue])

        const handleSelectNationality = useCallback(() => {
            const openPicker = async () => {
                const country = await request<SupportedCountry>({
                    contents: createElement(CardCountryPickerContent, {
                        title: t(
                            'peraCard.personal_details.nationality_picker_title',
                        ),
                    }),
                    // The picker owns a scrollable list, so it manages its own
                    // layout — `false` gives that list a bounded height to scroll.
                    options: { size: 'full', autoCreateContainer: false },
                })
                if (country) {
                    setSelectedNationality(country)
                    setValue('countryOfNationality', country.iso3166alpha2, {
                        shouldValidate: true,
                    })
                }
            }
            void openPicker()
        }, [request, setValue, t])

        const submitDetails = handleSubmit(
            async ({
                firstName,
                lastName,
                dateOfBirth,
                countryOfNationality,
            }) => {
                // Set by email/verify; if missing, re-verify rather than submit
                // an empty onboarding id.
                if (onboardingId === null) {
                    errorToast(
                        t('peraCard.personal_details.error_title'),
                        t('peraCard.personal_details.error_body'),
                    )
                    navigation.navigate('CardOnboardingEmailVerify')
                    return
                }
                try {
                    // TODO(card): confirm whether Baanx requires `ssn` for US
                    // residents — no SSN field is collected yet.
                    await submitPersonalDetails.mutateAsync({
                        onboardingId,
                        firstName,
                        lastName,
                        dateOfBirth: dobToIsoDate(dateOfBirth),
                        countryOfNationality,
                    })
                    navigation.navigate('CardOnboardingAddress')
                } catch {
                    errorToast(
                        t('peraCard.personal_details.error_title'),
                        t('peraCard.personal_details.error_body'),
                    )
                }
            },
        )

        const handleConfirm = () => {
            void submitDetails()
        }

        return {
            control,
            errors,
            isValid,
            isSubmitting: submitPersonalDetails.isPending,
            selectedNationality,
            handleSelectNationality,
            handleConfirm,
        }
    }
