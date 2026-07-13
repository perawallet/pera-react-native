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
    getCardApiError,
    isConflictError,
    phoneSendSchema,
    useCardStore,
    useRegistrationSettingsQuery,
    useSendPhoneVerificationMutation,
    type PhoneSendFormValues,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '@modules/card/components/CardCountryPicker'
import { useCardErrorToast } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

import type { Optional } from '@perawallet/wallet-core-shared'

export type UseCardOnboardingPhoneScreenResult = {
    control: Control<PhoneSendFormValues>
    errors: FieldErrors<PhoneSendFormValues>
    isValid: boolean
    isSubmitting: boolean
    selectedCallingCountry: Optional<SupportedCountry>
    handleSelectCallingCountry: () => void
    handleConfirm: () => void
}

export const useCardOnboardingPhoneScreen =
    (): UseCardOnboardingPhoneScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.verify_phone.send_error_title',
            bodyKey: 'peraCard.verify_phone.send_error_body',
        })
        const { request } = useBottomSheet()
        const countryIso = useCardStore(state => state.countryIso)
        const contactVerificationId = useCardStore(
            state => state.contactVerificationId,
        )
        const setPhone = useCardStore(state => state.setPhone)
        const sendPhoneVerification = useSendPhoneVerificationMutation()
        const { data: settings } = useRegistrationSettingsQuery()

        const [selectedCallingCountry, setSelectedCallingCountry] =
            useState<Optional<SupportedCountry>>(undefined)
        const hasPreselected = useRef(false)

        const {
            control,
            handleSubmit,
            setValue,
            setError,
            formState: { isValid, errors },
        } = useForm<PhoneSendFormValues>({
            resolver: zodResolver(phoneSendSchema),
            mode: 'onChange',
            defaultValues: { phoneCountryCode: '', phoneNumber: '' },
        })

        // Default the calling code to the residence country once settings load.
        useEffect(() => {
            if (hasPreselected.current || selectedCallingCountry) return
            if (!countryIso || !settings?.countries.length) return
            const match = settings.countries.find(
                country => country.iso3166alpha2 === countryIso,
            )
            if (!match) return
            hasPreselected.current = true
            setSelectedCallingCountry(match)
            setValue('phoneCountryCode', match.callingCode, {
                shouldValidate: true,
            })
        }, [countryIso, settings, selectedCallingCountry, setValue])

        const handleSelectCallingCountry = useCallback(() => {
            const openPicker = async () => {
                const country = await request<SupportedCountry>({
                    contents: createElement(CardCountryPickerContent),
                    // The picker owns a scrollable list, so it manages its own
                    // layout — `false` gives that list a bounded height to scroll.
                    options: { size: 'full', autoCreateContainer: false },
                })
                if (country) {
                    setSelectedCallingCountry(country)
                    setValue('phoneCountryCode', country.callingCode, {
                        shouldValidate: true,
                    })
                }
            }
            void openPicker()
        }, [request, setValue])

        const submitPhone = handleSubmit(
            async ({ phoneCountryCode, phoneNumber }) => {
                // Set by email/send; if missing, re-verify rather than send an empty id.
                if (contactVerificationId === null) {
                    errorToast(
                        t('peraCard.verify_phone.send_error_title'),
                        t('peraCard.verify_phone.send_error_body'),
                    )
                    navigation.navigate('CardOnboardingEmailVerify')
                    return
                }
                try {
                    await sendPhoneVerification.mutateAsync({
                        phoneCountryCode,
                        phoneNumber,
                        contactVerificationId,
                    })
                    setPhone({ phoneCountryCode, phoneNumber })
                    navigation.navigate('CardOnboardingPhoneVerify')
                } catch (error) {
                    // A conflict means the number is rejected (e.g. already
                    // registered) — attribute it to the field. Prefer Baanx's
                    // own message so the real reason shows; fall back to a
                    // localized string when the response carries none.
                    const apiError = await getCardApiError(error)
                    if (isConflictError(apiError)) {
                        setError('phoneNumber', {
                            type: 'server',
                            message:
                                apiError.message ??
                                t('peraCard.verify_phone.phone_taken'),
                        })
                        return
                    }
                    await showError(error)
                }
            },
        )

        const handleConfirm = () => {
            void submitPhone()
        }

        return {
            control,
            errors,
            isValid,
            isSubmitting: sendPhoneVerification.isPending,
            selectedCallingCountry,
            handleSelectCallingCountry,
            handleConfirm,
        }
    }
