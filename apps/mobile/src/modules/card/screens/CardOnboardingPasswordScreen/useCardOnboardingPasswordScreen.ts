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
    getCardApiError,
    isInvalidInputError,
    passwordSetSchema,
    useCardStore,
    useVerifyEmailMutation,
    useVerifyPhoneMutation,
    type PasswordSetFormValues,
} from '@perawallet/wallet-core-card'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

export type UseCardOnboardingPasswordScreenResult = {
    control: Control<PasswordSetFormValues>
    errors: FieldErrors<PasswordSetFormValues>
    /** Current password value, used to drive the live requirements checklist. */
    password: string
    isValid: boolean
    isSubmitting: boolean
    handleConfirm: () => void
}

export const useCardOnboardingPasswordScreen =
    (): UseCardOnboardingPasswordScreenResult => {
        const { t } = useLanguage()
        const { errorToast } = useToast()
        const navigation = useAppNavigation()
        const email = useCardStore(state => state.email)
        const countryIso = useCardStore(state => state.countryIso)
        const verificationCode = useCardStore(state => state.verificationCode)
        const phoneVerificationCode = useCardStore(
            state => state.phoneVerificationCode,
        )
        const phoneCountryCode = useCardStore(state => state.phoneCountryCode)
        const phoneNumber = useCardStore(state => state.phoneNumber)
        const contactVerificationId = useCardStore(
            state => state.contactVerificationId,
        )
        const existingOnboardingId = useCardStore(state => state.onboardingId)
        const setCodeVerificationError = useCardStore(
            state => state.setCodeVerificationError,
        )
        const verifyEmail = useVerifyEmailMutation()
        const verifyPhone = useVerifyPhoneMutation()

        const {
            control,
            handleSubmit,
            watch,
            formState: { isValid, errors },
        } = useForm<PasswordSetFormValues>({
            resolver: zodResolver(passwordSetSchema),
            mode: 'onChange',
            defaultValues: { password: '', confirmPassword: '' },
        })

        const password = watch('password')

        // The password step fires the two deferred Baanx calls back to back:
        // email/verify (completes email verification, sets the password, and
        // returns the onboardingId) and then phone/verify (which needs that
        // onboardingId — the reason the phone code screen only stashed it).
        const submitPassword = handleSubmit(async ({ password }) => {
            // The flow's data lives in the store, not nav params. Email,
            // country, and contactVerificationId are all established by the
            // email/send call on the first screen, so if any is missing (app
            // killed mid-flow, flow entered out of order, rehydration edge
            // case) restart there rather than POSTing incomplete data — going
            // back to verify wouldn't reissue the contactVerificationId.
            if (
                email === null ||
                countryIso === null ||
                contactVerificationId === null
            ) {
                errorToast(
                    t('peraCard.create_account.error_title'),
                    t('peraCard.create_account.error_body'),
                )
                navigation.navigate('CardOnboardingEmail')
                return
            }
            // The verification codes are transient OTPs that aren't persisted;
            // if one is missing, send the user back to the matching verify
            // screen rather than POSTing an empty code.
            if (verificationCode === null) {
                errorToast(
                    t('peraCard.create_account.error_title'),
                    t('peraCard.create_account.error_body'),
                )
                navigation.navigate('CardOnboardingEmailVerify')
                return
            }
            if (
                phoneCountryCode === null ||
                phoneNumber === null ||
                phoneVerificationCode === null
            ) {
                errorToast(
                    t('peraCard.verify_phone.verify_error_title'),
                    t('peraCard.verify_phone.verify_error_body'),
                )
                navigation.navigate(
                    phoneCountryCode === null || phoneNumber === null
                        ? 'CardOnboardingPhone'
                        : 'CardOnboardingPhoneVerify',
                )
                return
            }
            // email/verify sets the password and completes email verification,
            // so it runs on the first pass. If an onboardingId already exists
            // (the user came back here after the deferred phone/verify failed),
            // the password is set and the email code is already spent — skip it
            // and re-run only the phone/verify below.
            let onboardingId = existingOnboardingId
            if (onboardingId === null) {
                try {
                    const result = await verifyEmail.mutateAsync({
                        email,
                        password,
                        verificationCode,
                        contactVerificationId,
                        countryOfResidence: countryIso,
                    })
                    onboardingId = result.onboardingId
                } catch (error) {
                    // A rejected submission here most plausibly means the
                    // deferred email code was wrong/expired (the password
                    // passed client rules and the ids are server-issued), so
                    // route back to re-enter it with an inline error. Other
                    // failures keep the generic toast.
                    const apiError = await getCardApiError(error)
                    if (isInvalidInputError(apiError)) {
                        setCodeVerificationError('email')
                        navigation.navigate('CardOnboardingEmailVerify')
                        return
                    }
                    errorToast(
                        t('peraCard.create_account.error_title'),
                        t('peraCard.create_account.error_body'),
                    )
                    return
                }
            }
            try {
                await verifyPhone.mutateAsync({
                    onboardingId,
                    phoneCountryCode,
                    phoneNumber,
                    contactVerificationId,
                    verificationCode: phoneVerificationCode,
                })
                // Both verifications done: KYC (identity verification) is next.
                navigation.navigate('CardOnboardingVerification')
            } catch (error) {
                // Route back to the phone code screen so the user can retry
                // (the onboardingId now exists, so the retry verifies
                // directly). Only flag it as a bad code for a 400/422 — other
                // failures (network, 5xx) keep just the generic toast rather
                // than mislabeling them as an incorrect code.
                const apiError = await getCardApiError(error)
                if (isInvalidInputError(apiError)) {
                    setCodeVerificationError('phone')
                }
                errorToast(
                    t('peraCard.verify_phone.verify_error_title'),
                    t('peraCard.verify_phone.verify_error_body'),
                )
                navigation.navigate('CardOnboardingPhoneVerify')
            }
        })

        const handleConfirm = () => {
            void submitPassword()
        }

        return {
            control,
            errors,
            password,
            isValid,
            isSubmitting: verifyEmail.isPending || verifyPhone.isPending,
            handleConfirm,
        }
    }
