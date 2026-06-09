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
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    OnboardingStep,
    passwordSetSchema,
    useCardStore,
    useVerifyEmailMutation,
    type PasswordSetFormValues,
} from '@perawallet/wallet-core-card'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

type UseCardOnboardingPasswordScreenParams = {
    email: string
    countryIso: string
    verificationCode: string
}

/** Per-field UI state for a password input: its reveal toggle + focus. */
export type PasswordFieldState = {
    isVisible: boolean
    isFocused: boolean
    toggleVisibility: () => void
    handleFocus: () => void
    handleBlur: () => void
}

export type UseCardOnboardingPasswordScreenResult = {
    control: Control<PasswordSetFormValues>
    errors: FieldErrors<PasswordSetFormValues>
    isValid: boolean
    isSubmitting: boolean
    passwordField: PasswordFieldState
    confirmPasswordField: PasswordFieldState
    handleConfirm: () => void
}

// The show/hide icon is only rendered while the field is focused, so each input
// tracks its own focus + reveal state. Called once per input below.
const usePasswordFieldState = (): PasswordFieldState => {
    const [isVisible, setIsVisible] = useState(false)
    const [isFocused, setIsFocused] = useState(false)

    const toggleVisibility = useCallback(() => setIsVisible(prev => !prev), [])
    const handleFocus = useCallback(() => setIsFocused(true), [])
    const handleBlur = useCallback(() => setIsFocused(false), [])

    return { isVisible, isFocused, toggleVisibility, handleFocus, handleBlur }
}

export const useCardOnboardingPasswordScreen = ({
    email,
    countryIso,
    verificationCode,
}: UseCardOnboardingPasswordScreenParams): UseCardOnboardingPasswordScreenResult => {
    const { t } = useLanguage()
    const { successToast, errorToast } = useToast()
    const contactVerificationId = useCardStore(
        state => state.contactVerificationId,
    )
    const setOnboardingId = useCardStore(state => state.setOnboardingId)
    const setOnboardingStep = useCardStore(state => state.setOnboardingStep)
    const verifyEmail = useVerifyEmailMutation()

    const passwordField = usePasswordFieldState()
    const confirmPasswordField = usePasswordFieldState()

    const {
        control,
        handleSubmit,
        formState: { isValid, errors },
    } = useForm<PasswordSetFormValues>({
        resolver: zodResolver(passwordSetSchema),
        mode: 'onChange',
        defaultValues: { password: '', confirmPassword: '' },
    })

    // This is the real Baanx `email/verify` call (mocked for now): it completes
    // verification, sets the password, and returns the onboarding id.
    const submitPassword = handleSubmit(async ({ password }) => {
        try {
            const { onboardingId } = await verifyEmail.mutateAsync({
                email,
                password,
                verificationCode,
                contactVerificationId: contactVerificationId ?? '',
                countryOfResidence: countryIso,
            })
            setOnboardingId(onboardingId)
            setOnboardingStep(OnboardingStep.PhoneSend)
            successToast(
                t('peraCard.create_password.success_title'),
                t('peraCard.create_password.success_body'),
            )
        } catch {
            errorToast(
                t('peraCard.create_account.error_title'),
                t('peraCard.create_account.error_body'),
            )
        }
    })

    const handleConfirm = () => {
        void submitPassword()
    }

    return {
        control,
        errors,
        isValid,
        isSubmitting: verifyEmail.isPending,
        passwordField,
        confirmPasswordField,
        handleConfirm,
    }
}
