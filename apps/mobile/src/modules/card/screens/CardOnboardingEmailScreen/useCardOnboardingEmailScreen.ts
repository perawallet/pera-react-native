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

import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    emailSendSchema,
    OnboardingStep,
    useCardStore,
    useSendEmailVerificationMutation,
    type EmailSendFormValues,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

import type { Control, FieldErrors } from 'react-hook-form'
import type { Optional } from '@perawallet/wallet-core-shared'

export type UseCardOnboardingEmailScreenResult = {
    control: Control<EmailSendFormValues>
    errors: FieldErrors<EmailSendFormValues>
    isValid: boolean
    isSubmitting: boolean
    selectedCountry: Optional<SupportedCountry>
    handleSelectCountry: () => void
    handleConfirm: () => void
}

export const useCardOnboardingEmailScreen =
    (): UseCardOnboardingEmailScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const { requestByType } = useBottomSheet()
        const setOnboardingStep = useCardStore(state => state.setOnboardingStep)
        const sendEmailVerification = useSendEmailVerificationMutation()

        const [selectedCountry, setSelectedCountry] =
            useState<Optional<SupportedCountry>>(undefined)

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

        const handleSelectCountry = useCallback(() => {
            const openPicker = async () => {
                const country = await requestByType<
                    'card-country-picker',
                    SupportedCountry
                >('card-country-picker', {}, { size: 'full' })
                if (country) {
                    setSelectedCountry(country)
                    setValue('countryIso', country.iso3166alpha2, {
                        shouldValidate: true,
                    })
                }
            }
            void openPicker()
        }, [requestByType, setValue])

        const handleConfirm = handleSubmit(async ({ email, countryIso }) => {
            try {
                await sendEmailVerification.mutateAsync({ email })
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

        return {
            control,
            errors,
            isValid,
            isSubmitting: sendEmailVerification.isPending,
            selectedCountry,
            handleSelectCountry,
            handleConfirm,
        }
    }
