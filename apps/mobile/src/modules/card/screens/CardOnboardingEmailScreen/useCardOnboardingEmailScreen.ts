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
    emailSendSchema,
    getCardApiError,
    isConflictError,
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
import { trackEvent, CardEvent, AnalyticsMetadataKey } from '@analytics'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '@modules/card/components/CardCountryPicker'
import { CardWaitlistSuccessContent } from '@modules/card/components/CardWaitlistSuccessContent'
import { useCardErrorToast } from '@modules/card/hooks'
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
        const showError = useCardErrorToast({
            titleKey: 'peraCard.create_account.error_title',
            bodyKey: 'peraCard.create_account.error_body',
        })
        const { request } = useBottomSheet()
        const { network } = useNetwork()
        const deviceId = useDeviceID(network)
        const setEmail = useCardStore(state => state.setEmail)
        const setCountryIso = useCardStore(state => state.setCountryIso)
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
            setError,
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
                    // The picker owns a scrollable list, so it manages its own
                    // layout — `false` gives that list a bounded height to scroll.
                    options: { size: 'full', autoCreateContainer: false },
                })
                if (country) {
                    trackEvent(CardEvent.CreateCountrySelect, {
                        [AnalyticsMetadataKey.CountryId]: country.iso3166alpha2,
                    })
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
                // The mutation's onSuccess stores contactVerificationId and
                // advances the step; we just persist the user's inputs and move on.
                await sendEmailVerification.mutateAsync({ email })
                setEmail(email)
                setCountryIso(countryIso)
                navigation.navigate('CardOnboardingEmailVerify')
            } catch (error) {
                // A conflict means the email is rejected (e.g. already
                // registered) — attribute it to the field. Prefer Baanx's own
                // message so the real reason shows; fall back to a localized
                // string when the response carries none.
                const apiError = await getCardApiError(error)
                if (isConflictError(apiError)) {
                    setError('email', {
                        type: 'server',
                        message:
                            apiError.message ??
                            t('peraCard.create_account.email_taken'),
                    })
                    return
                }
                await showError(error, apiError)
            }
        })

        const handleConfirm = () => {
            trackEvent(CardEvent.CreateConfirmEmail)
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
