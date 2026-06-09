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
    emailSendSchema,
    OnboardingStep,
    useCardStore,
    useCurrentRegionQuery,
    useRegistrationSettingsQuery,
    useRequestCountryAvailabilityMutation,
    useSendEmailVerificationMutation,
    type EmailSendFormValues,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '@modules/card/components/CardCountryPicker'
import { CardWaitlistSuccessContent } from '@modules/card/components/CardWaitlistSuccessContent'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

import type { Optional } from '@perawallet/wallet-core-shared'

export type UseCardOnboardingEmailScreenResult = {
    control: Control<EmailSendFormValues>
    errors: FieldErrors<EmailSendFormValues>
    isValid: boolean
    isSubmitting: boolean
    selectedCountry: Optional<SupportedCountry>
    /** True when the picked country isn't supported yet (offer the waitlist). */
    isWaitlistCountry: boolean
    isJoiningWaitlist: boolean
    handleSelectCountry: () => void
    handleConfirm: () => void
    handleJoinWaitlist: () => void
}

export const useCardOnboardingEmailScreen =
    (): UseCardOnboardingEmailScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const { request } = useBottomSheet()
        const { network } = useNetwork()
        const deviceId = useDeviceID(network)
        const setOnboardingStep = useCardStore(state => state.setOnboardingStep)
        const setContactVerificationId = useCardStore(
            state => state.setContactVerificationId,
        )
        const sendEmailVerification = useSendEmailVerificationMutation()
        const requestCountryAvailability =
            useRequestCountryAvailabilityMutation()
        const { data: settings } = useRegistrationSettingsQuery()
        const { data: currentRegion } = useCurrentRegionQuery()

        const [selectedCountry, setSelectedCountry] =
            useState<Optional<SupportedCountry>>(undefined)
        const hasPreselectedRegion = useRef(false)

        const {
            control,
            handleSubmit,
            setValue,
            formState: { isValid, errors },
        } = useForm<EmailSendFormValues>({
            resolver: zodResolver(emailSendSchema),
            mode: 'onChange',
            defaultValues: { email: '', countryIso: '' },
        })

        // Preselect the geo-IP detected region once both queries resolve, unless
        // the user already picked a country. Only fires once, and only if the
        // detected country is in the supported list (otherwise leave it blank).
        useEffect(() => {
            if (hasPreselectedRegion.current || selectedCountry) return
            if (!currentRegion || !settings?.countries.length) return
            const match = settings.countries.find(
                country =>
                    country.iso3166alpha2 === currentRegion.iso3166alpha2,
            )
            if (!match) return
            hasPreselectedRegion.current = true
            setSelectedCountry(match)
            setValue('countryIso', match.iso3166alpha2, {
                shouldValidate: true,
            })
        }, [currentRegion, settings, selectedCountry, setValue])

        const isWaitlistCountry =
            !!selectedCountry && !selectedCountry.canSignUp

        const handleSelectCountry = useCallback(() => {
            const openPicker = async () => {
                const country = await request<SupportedCountry>({
                    contents: createElement(CardCountryPickerContent),
                    options: { size: 'full' },
                })
                if (country) {
                    setSelectedCountry(country)
                    setValue('countryIso', country.iso3166alpha2, {
                        shouldValidate: true,
                    })
                }
            }
            void openPicker()
        }, [request, setValue])

        const submitEmail = handleSubmit(async ({ email, countryIso }) => {
            try {
                const { contactVerificationId } =
                    await sendEmailVerification.mutateAsync({ email })
                setContactVerificationId(contactVerificationId)
                setOnboardingStep(OnboardingStep.EmailVerify)
                navigation.navigate('CardOnboardingEmailVerify', {
                    email,
                    countryIso,
                })
            } catch {
                errorToast(
                    t('peraCard.create_account.error_title'),
                    t('peraCard.create_account.error_body'),
                )
            }
        })

        const handleConfirm = () => {
            void submitEmail()
        }

        const handleJoinWaitlist = useCallback(() => {
            if (!selectedCountry) return
            // A real device id exists once the device is registered; without it
            // the backend record would be useless, so surface an error instead.
            if (!deviceId) {
                errorToast(
                    t('peraCard.waitlist.error_title'),
                    t('peraCard.waitlist.error_body'),
                )
                return
            }
            const join = async () => {
                try {
                    await requestCountryAvailability.mutateAsync({
                        countryCode: selectedCountry.iso3166alpha2,
                        deviceId,
                    })
                    // The success sheet's CTA resolves true → return home;
                    // swiping it away (undefined) just stays on the screen.
                    const returnHome = await request<boolean>({
                        contents: createElement(CardWaitlistSuccessContent, {
                            countryName: selectedCountry.name,
                        }),
                    })
                    if (returnHome) {
                        navigation.navigate('TabBar', { screen: 'Home' })
                    }
                } catch {
                    errorToast(
                        t('peraCard.waitlist.error_title'),
                        t('peraCard.waitlist.error_body'),
                    )
                }
            }
            void join()
        }, [
            selectedCountry,
            deviceId,
            requestCountryAvailability,
            request,
            navigation,
            errorToast,
            t,
        ])

        return {
            control,
            errors,
            isValid,
            isSubmitting: sendEmailVerification.isPending,
            selectedCountry,
            isWaitlistCountry,
            isJoiningWaitlist: requestCountryAvailability.isPending,
            handleSelectCountry,
            handleConfirm,
            handleJoinWaitlist,
        }
    }
