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

import { createElement, useCallback, useState } from 'react'
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    mailingAddressSchema,
    useCardStore,
    useSubmitMailingAddressMutation,
    type MailingAddressFormValues,
    type SupportedUsState,
} from '@perawallet/wallet-core-chain-algorand/card'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardUsStatePickerContent } from '@modules/card/components/CardUsStatePicker'
import { useCardErrorToast } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

export type UseCardOnboardingMailingAddressScreenResult = {
    control: Control<MailingAddressFormValues>
    errors: FieldErrors<MailingAddressFormValues>
    isValid: boolean
    isSubmitting: boolean
    selectedUsState: Optional<SupportedUsState>
    handleSelectUsState: () => void
    handleConfirm: () => void
}

/**
 * US residents who ship the card somewhere other than their residence. The
 * address step withheld the session token for them, so this submit is the one
 * that completes registration and hands back to the setup checklist.
 */
export const useCardOnboardingMailingAddressScreen =
    (): UseCardOnboardingMailingAddressScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const { errorToast } = useToast()
        const { request } = useBottomSheet()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.address.error_title',
            bodyKey: 'peraCard.address.error_body',
        })
        const onboardingId = useCardStore(state => state.onboardingId)
        const submitMailingAddress = useSubmitMailingAddressMutation()

        const [selectedUsState, setSelectedUsState] =
            useState<Optional<SupportedUsState>>(undefined)

        const {
            control,
            handleSubmit,
            setValue,
            formState: { isValid, errors },
        } = useForm<MailingAddressFormValues>({
            resolver: zodResolver(mailingAddressSchema),
            mode: 'onChange',
            defaultValues: {
                addressLine1: '',
                addressLine2: '',
                city: '',
                zip: '',
                usState: '',
            },
        })

        const handleSelectUsState = useCallback(() => {
            const openPicker = async () => {
                const usState = await request<SupportedUsState>({
                    contents: createElement(CardUsStatePickerContent),
                    // The picker owns a scrollable list, so it manages its own
                    // layout; `false` gives that list a bounded height to scroll.
                    options: { size: 'full', autoCreateContainer: false },
                })
                if (!usState) return
                setSelectedUsState(usState)
                setValue('usState', usState.postalAbbreviation, {
                    shouldValidate: true,
                })
            }
            void openPicker()
        }, [request, setValue])

        const submitForm = handleSubmit(async values => {
            // Set by email/verify; if missing, re-verify rather than submit an
            // empty onboarding id.
            if (onboardingId === null) {
                errorToast(
                    t('peraCard.address.error_title'),
                    t('peraCard.address.error_body'),
                )
                navigation.navigate('CardOnboardingEmailVerify')
                return
            }
            try {
                await submitMailingAddress.mutateAsync({
                    onboardingId,
                    addressLine1: values.addressLine1,
                    city: values.city,
                    zip: values.zip,
                    usState: values.usState,
                    ...(values.addressLine2
                        ? { addressLine2: values.addressLine2 }
                        : {}),
                })
                navigation.navigate('CardOnboardingStatus')
            } catch (error) {
                await showError(error)
            }
        })

        const handleConfirm = () => {
            void submitForm()
        }

        return {
            control,
            errors,
            isValid,
            isSubmitting: submitMailingAddress.isPending,
            selectedUsState,
            handleSelectUsState,
            handleConfirm,
        }
    }
