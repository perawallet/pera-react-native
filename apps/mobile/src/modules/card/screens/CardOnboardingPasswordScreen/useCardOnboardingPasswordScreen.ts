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

import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    getCardApiError,
    isInvalidInputError,
    passwordSetSchema,
    useCardStore,
    useVerifyEmailMutation,
    type PasswordSetFormValues,
} from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import { useCardErrorToast } from '@modules/card/hooks'
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
    /** Marketing-consent opt-in; sent on email/verify. Optional — doesn't gate submit. */
    allowMarketing: boolean
    /** SMS-consent opt-in; sent on email/verify. Required by Baanx — gates submit. */
    allowSms: boolean
    handleToggleMarketing: () => void
    handleToggleSms: () => void
    handleConfirm: () => void
}

export const useCardOnboardingPasswordScreen =
    (): UseCardOnboardingPasswordScreenResult => {
        const { t } = useLanguage()
        const { errorToast, infoToast } = useToast()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.create_account.error_title',
            bodyKey: 'peraCard.create_account.error_body',
        })
        const navigation = useAppNavigation()
        const email = useCardStore(state => state.email)
        const countryIso = useCardStore(state => state.countryIso)
        const verificationCode = useCardStore(state => state.verificationCode)
        const contactVerificationId = useCardStore(
            state => state.contactVerificationId,
        )
        const existingOnboardingId = useCardStore(state => state.onboardingId)
        const setCodeVerificationError = useCardStore(
            state => state.setCodeVerificationError,
        )
        // Consent opt-ins, collected here and required by email/verify.
        const allowMarketing = useCardStore(state => state.allowMarketing)
        const allowSms = useCardStore(state => state.allowSms)
        const setAllowMarketing = useCardStore(state => state.setAllowMarketing)
        const setAllowSms = useCardStore(state => state.setAllowSms)
        const verifyEmail = useVerifyEmailMutation()

        const {
            control,
            handleSubmit,
            watch,
            formState: { isValid: isFormValid, errors },
        } = useForm<PasswordSetFormValues>({
            resolver: zodResolver(passwordSetSchema),
            mode: 'onChange',
            defaultValues: { password: '', confirmPassword: '' },
        })

        const password = watch('password')

        // This step fires email/verify — the Baanx call that completes email
        // verification, sets the password, and returns the onboardingId. It runs
        // right after the email code is entered (the previous screen), so the
        // code is still fresh; the phone steps come next and use the onboardingId.
        const submitPassword = handleSubmit(async ({ password }) => {
            // SMS consent is required by Baanx and gates the Continue button;
            // guard here too so no edge path (a stray/programmatic submit, a
            // render race) can POST email/verify with allowSms:false.
            if (!allowSms) return
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
            // The email code is a transient OTP that isn't persisted; if it's
            // missing, send the user back to re-enter it rather than POSTing an
            // empty code.
            if (verificationCode === null) {
                errorToast(
                    t('peraCard.create_account.error_title'),
                    t('peraCard.create_account.error_body'),
                )
                navigation.navigate('CardOnboardingEmailVerify')
                return
            }
            // If an onboardingId already exists, email/verify already ran (the
            // user backed into this screen after moving on): the password is set
            // and the email code is spent, so skip the call and continue to the
            // phone steps. The consent boxes were still shown and answered on
            // this screen, so commit them like the success path does — leaving
            // marketing null here would make the address step re-ask.
            if (existingOnboardingId !== null) {
                setAllowMarketing(allowMarketing ?? false)
                navigation.navigate('CardOnboardingPhone')
                return
            }
            try {
                const { onboardingId, hasAccount } =
                    await verifyEmail.mutateAsync({
                        email,
                        password,
                        verificationCode,
                        contactVerificationId,
                        countryOfResidence: countryIso,
                        allowMarketing: allowMarketing ?? false,
                        allowSms,
                    })
                // Baanx answers 200 with `hasAccount: true` (and no onboardingId)
                // when the email is already registered — send the user to sign
                // in rather than showing a generic failure.
                if (hasAccount) {
                    infoToast(
                        t('peraCard.create_account.already_registered_title'),
                        t('peraCard.create_account.already_registered_body'),
                    )
                    navigation.navigate('CardSignIn')
                    return
                }
                // A 200 with neither an account flag nor a usable id is malformed
                // — surface a clean error instead of advancing to the phone step
                // with a null onboardingId (which dead-ends at phone/verify).
                if (onboardingId === null) {
                    await showError(null)
                    return
                }
                // Commit the answered consents (an untouched marketing box is
                // an explicit "declined", not "never asked") so the address
                // step's consent call reuses them instead of re-collecting.
                setAllowMarketing(allowMarketing ?? false)
                // Email verified and password set: on to the phone steps.
                navigation.navigate('CardOnboardingPhone')
            } catch (error) {
                // A rejected submission here most plausibly means the email code
                // was wrong/expired (the password passed client rules and the
                // ids are server-issued), so route back to re-enter it with an
                // inline error. Other failures keep the generic toast.
                const apiError = await getCardApiError(error)
                if (isInvalidInputError(apiError)) {
                    setCodeVerificationError('email')
                    navigation.navigate('CardOnboardingEmailVerify')
                    return
                }
                await showError(error, apiError)
            }
        })

        const handleConfirm = () => {
            trackEvent(CardEvent.CreatePassword)
            void submitPassword()
        }

        const handleToggleMarketing = () => setAllowMarketing(!allowMarketing)
        const handleToggleSms = () => setAllowSms(!allowSms)

        return {
            control,
            errors,
            password,
            // Baanx requires SMS consent to register, so it gates submission
            // (marketing stays optional) — mirrors the address step's T&C gating.
            isValid: isFormValid && allowSms === true,
            isSubmitting: verifyEmail.isPending,
            allowMarketing: allowMarketing ?? false,
            allowSms: allowSms ?? false,
            handleToggleMarketing,
            handleToggleSms,
            handleConfirm,
        }
    }
