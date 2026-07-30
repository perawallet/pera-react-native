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

import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    dobToIsoDate,
    getCardApiError,
    isDuplicateError,
    isoDateToDob,
    OnboardingNotVerifiedError,
    personalDetailsSchema,
    useCardStore,
    useOnboardingDetailsQuery,
    useOnboardingKycGate,
    useRegistrationSettingsQuery,
    useSubmitPersonalDetailsMutation,
    type PersonalDetailsFormValues,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '@modules/card/components/CardCountryPicker'
import { useCardErrorToast } from '@modules/card/hooks'
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
    /** Fields the server already has are prefilled and locked (read-only). */
    isFirstNameLocked: boolean
    isLastNameLocked: boolean
    isDateOfBirthLocked: boolean
    isNationalityLocked: boolean
    /**
     * The record's identity check isn't far enough along for Baanx to accept
     * this step, so the form is replaced by the "finish verifying" view.
     */
    isKycRequired: boolean
    /** Sends the user back to the identity-verification step. */
    handleVerifyIdentity: () => void
    handleSelectNationality: () => void
    handleConfirm: () => void
}

export const useCardOnboardingPersonalDetailsScreen =
    (): UseCardOnboardingPersonalDetailsScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.personal_details.error_title',
            bodyKey: 'peraCard.personal_details.error_body',
        })
        // Baanx's own wording for this is "User is not verified", which reads
        // as an account problem rather than an unfinished step, so this toast
        // always uses our copy.
        const showKycError = useCardErrorToast({
            titleKey: 'peraCard.kyc_required.title',
            bodyKey: 'peraCard.kyc_required.body',
            shouldUseBackendMessage: false,
        })
        const { request } = useBottomSheet()
        const onboardingId = useCardStore(state => state.onboardingId)
        const countryIso = useCardStore(state => state.countryIso)
        const submitPersonalDetails = useSubmitPersonalDetailsMutation()
        const { data: settings } = useRegistrationSettingsQuery()
        // On resume the onboarding record already holds the user's details, so
        // we prefill them and lock the fields the server has confirmed.
        const { data: onboardingDetails } = useOnboardingDetailsQuery({
            onboardingId,
        })

        const isFirstNameLocked = Boolean(onboardingDetails?.firstName)
        const isLastNameLocked = Boolean(onboardingDetails?.lastName)
        const isDateOfBirthLocked = Boolean(onboardingDetails?.dateOfBirth)

        const { isKycRequired, markServerRefused } = useOnboardingKycGate({
            onboardingId,
        })

        const handleVerifyIdentity = useCallback(() => {
            navigation.navigate('CardOnboardingVerification')
        }, [navigation])

        // The server's confirmed nationality, resolved against the supported
        // list so we can render its flag/name. Lock the field only when it
        // actually resolves — a nationality the list doesn't contain (e.g.
        // pulled from the KYC scan, or a list that shrank between sessions)
        // must stay editable, otherwise the unmatched value would leave the
        // field empty *and* locked, blocking submit with no way to fix it.
        const serverNationality =
            onboardingDetails?.countryOfNationality ?? null
        const serverNationalityCountry = serverNationality
            ? settings?.countries.find(
                  country => country.iso3166alpha2 === serverNationality,
              )
            : undefined
        const isNationalityLocked = Boolean(serverNationalityCountry)

        const [selectedNationality, setSelectedNationality] =
            useState<Optional<SupportedCountry>>(undefined)
        const hasPreselected = useRef(false)
        const hasPrefilled = useRef(false)

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

        // Prefill the text fields from the onboarding record once it loads.
        // Only fires once and only for fields the server actually returned, so a
        // fresh registration (all profile fields null) leaves the form empty.
        useEffect(() => {
            if (hasPrefilled.current || !onboardingDetails) return
            const { firstName, lastName, dateOfBirth } = onboardingDetails
            if (!firstName && !lastName && !dateOfBirth) return
            hasPrefilled.current = true
            if (firstName) {
                setValue('firstName', firstName, { shouldValidate: true })
            }
            if (lastName) {
                setValue('lastName', lastName, { shouldValidate: true })
            }
            if (dateOfBirth) {
                setValue('dateOfBirth', isoDateToDob(dateOfBirth), {
                    shouldValidate: true,
                })
            }
        }, [onboardingDetails, setValue])

        // Preselect the nationality once settings load: prefer the server's
        // confirmed value (resume), else fall back to the residence country as
        // a changeable guess — including when the server value isn't in the
        // supported list. Fires once and never overrides a manual pick.
        useEffect(() => {
            if (hasPreselected.current || selectedNationality) return
            if (!settings?.countries.length) return
            const match =
                serverNationalityCountry ??
                (countryIso
                    ? settings.countries.find(
                          country => country.iso3166alpha2 === countryIso,
                      )
                    : undefined)
            if (!match) return
            hasPreselected.current = true
            setSelectedNationality(match)
            setValue('countryOfNationality', match.iso3166alpha2, {
                shouldValidate: true,
            })
        }, [
            serverNationalityCountry,
            countryIso,
            settings,
            selectedNationality,
            setValue,
        ])

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
                } catch (error) {
                    // Checked before getCardApiError: the typed error carries
                    // no body, so it would otherwise fall through to the
                    // generic toast and the signal would be lost.
                    if (error instanceof OnboardingNotVerifiedError) {
                        markServerRefused()
                        await showKycError(error)
                        return
                    }
                    // A duplicate means Baanx already holds these details (a
                    // retried non-idempotent submit) — continue rather than
                    // strand the user. Otherwise prefer Baanx's own message so
                    // the real reason shows (e.g. a wrong-phase rejection).
                    const apiError = await getCardApiError(error)
                    if (isDuplicateError(apiError)) {
                        navigation.navigate('CardOnboardingAddress')
                        return
                    }
                    await showError(error, apiError)
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
            isFirstNameLocked,
            isLastNameLocked,
            isDateOfBirthLocked,
            isNationalityLocked,
            isKycRequired,
            handleVerifyIdentity,
            handleSelectNationality,
            handleConfirm,
        }
    }
