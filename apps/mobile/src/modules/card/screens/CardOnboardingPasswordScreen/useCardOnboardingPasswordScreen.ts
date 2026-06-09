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

import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    passwordSetSchema,
    useCardStore,
    useVerifyEmailMutation,
    type PasswordSetFormValues,
} from '@perawallet/wallet-core-card'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

export type UseCardOnboardingPasswordScreenResult = {
    control: Control<PasswordSetFormValues>
    errors: FieldErrors<PasswordSetFormValues>
    isValid: boolean
    isSubmitting: boolean
    handleConfirm: () => void
}

export const useCardOnboardingPasswordScreen =
    (): UseCardOnboardingPasswordScreenResult => {
        const { t } = useLanguage()
        const { successToast, errorToast } = useToast()
        const navigation = useAppNavigation()
        const email = useCardStore(state => state.email)
        const countryIso = useCardStore(state => state.countryIso)
        const verificationCode = useCardStore(state => state.verificationCode)
        const contactVerificationId = useCardStore(
            state => state.contactVerificationId,
        )
        const verifyEmail = useVerifyEmailMutation()

        const {
            control,
            handleSubmit,
            formState: { isValid, errors },
        } = useForm<PasswordSetFormValues>({
            resolver: zodResolver(passwordSetSchema),
            mode: 'onChange',
            defaultValues: { password: '', confirmPassword: '' },
        })

        // This is the real Baanx `email/verify` call (mocked for now): it
        // completes verification and sets the password. The mutation's
        // onSuccess stores the onboarding id and advances the flow.
        const submitPassword = handleSubmit(async ({ password }) => {
            // The flow's data lives in the store, not nav params. The
            // verification code is a transient OTP that isn't persisted, so if
            // we ever land here without it (e.g. the app was killed mid-flow),
            // send the user back to re-verify rather than POSTing an empty code.
            if (
                email === null ||
                countryIso === null ||
                verificationCode === null ||
                contactVerificationId === null
            ) {
                errorToast(
                    t('peraCard.create_account.error_title'),
                    t('peraCard.create_account.error_body'),
                )
                navigation.navigate('CardOnboardingEmailVerify')
                return
            }
            try {
                await verifyEmail.mutateAsync({
                    email,
                    password,
                    verificationCode,
                    contactVerificationId,
                    countryOfResidence: countryIso,
                })
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
            handleConfirm,
        }
    }
