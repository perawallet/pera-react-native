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

import { useCallback, useState } from 'react'
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    getCardApiError,
    isInvalidInputError,
    signInSchema,
    useCardLoginMutation,
    useCardStore,
    useSendLoginOtpMutation,
    type SignInFormValues,
} from '@perawallet/wallet-core-card'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useCountdown } from '@hooks/useCountdown'
import { CARD_VERIFICATION_CODE_LENGTH } from '../cardVerificationConstants'
import { getOnboardingResumeRoute } from './getOnboardingResumeRoute'

/** Seconds the user must wait before the OTP code can be re-requested. */
const RESEND_COOLDOWN_SECONDS = 60

export type UseCardSignInScreenResult = {
    control: Control<SignInFormValues>
    errors: FieldErrors<SignInFormValues>
    isValid: boolean
    isSubmitting: boolean
    /** When true, login returned `isOtpRequired`; reveal the 2FA code input. */
    isOtpRequired: boolean
    otpCode: string
    onChangeOtp: (text: string) => void
    isOtpValid: boolean
    /** Set when a prior OTP attempt was rejected; shown inline on the input. */
    otpError?: string
    secondsRemaining: number
    canResend: boolean
    handleResendOtp: () => void
    /**
     * `submittedOtp` is passed by `PWCodeInput`'s `onComplete` (auto-submit),
     * carrying the just-completed value because the `otpCode` state hasn't
     * re-rendered yet. The button/keyboard call it with no arg.
     */
    handleSignIn: (submittedOtp?: string) => void
    handleForgotPassword: () => void
}

export const useCardSignInScreen = (): UseCardSignInScreenResult => {
    const { t } = useLanguage()
    const { errorToast, successToast, infoToast } = useToast()
    const navigation = useAppNavigation()
    const login = useCardLoginMutation()
    const sendOtp = useSendLoginOtpMutation()

    const {
        control,
        handleSubmit,
        getValues,
        setError,
        formState: { isValid, errors },
    } = useForm<SignInFormValues>({
        resolver: zodResolver(signInSchema),
        mode: 'onChange',
        defaultValues: { email: '', password: '' },
    })

    const [isOtpRequired, setIsOtpRequired] = useState(false)
    // `userId` from the login attempt that required 2FA — /v1/auth/login/otp
    // is keyed on it for both the initial send and resends.
    const [otpUserId, setOtpUserId] = useState<string | null>(null)
    const [otpCode, setOtpCode] = useState('')
    const [hasOtpError, setHasOtpError] = useState(false)
    const { secondsRemaining, isActive, restart } = useCountdown(
        RESEND_COOLDOWN_SECONDS,
    )

    const onChangeOtp = useCallback(
        (text: string) => {
            setOtpCode(text)
            // Editing clears the "code invalid" flag from a failed attempt.
            if (hasOtpError) setHasOtpError(false)
        },
        [hasOtpError],
    )

    // Asks Baanx to send (or re-send) the 2FA code. Baanx does not send it on
    // its own when login returns `isOtpRequired` — this call is what triggers
    // the SMS. The resend cooldown arms only when the send succeeds; a failure
    // surfaces as a toast and leaves the button usable for an immediate retry.
    // Depends on the stable `mutateAsync` (not the per-render mutation object)
    // so the callback chain below isn't recreated every keystroke.
    const sendOtpAsync = sendOtp.mutateAsync
    const requestOtpCode = useCallback(
        (userId: string) => {
            sendOtpAsync({ userId })
                .then(() => restart())
                .catch(() => {
                    errorToast(
                        t('peraCard.sign_in.error_title'),
                        t('peraCard.sign_in.error_body'),
                    )
                })
        },
        [sendOtpAsync, restart, errorToast, t],
    )

    // The login call handles both passes: the first (no `otp`) may come back
    // `isOtpRequired`, which triggers the OTP send and reveals the code input;
    // the second carries the code and completes the OAuth exchange. The session
    // is persisted inside the mutation's `onSuccess`.
    const performLogin = useCallback(
        async (email: string, password: string, otp?: string) => {
            try {
                const result = await login.mutateAsync({
                    email,
                    password,
                    otpCode: otp,
                })

                // Credentials accepted but a 2FA code is required — ask Baanx
                // to send the code and reveal the input (the send arms the
                // resend cooldown when it succeeds). Without a userId the code
                // can never be requested, so surface an error instead of an
                // input no code will reach.
                if (result.isOtpRequired && !result.accessToken) {
                    if (!result.userId) {
                        errorToast(
                            t('peraCard.sign_in.error_title'),
                            t('peraCard.sign_in.error_body'),
                        )
                        return
                    }
                    setIsOtpRequired(true)
                    setOtpUserId(result.userId)
                    requestOtpCode(result.userId)
                    return
                }

                // Fully onboarded: a real access token is issued only once
                // onboarding completes and is persisted in the mutation's
                // `onSuccess`. Honor it before any (possibly stale) `phase` so a
                // completed account always lands on Home rather than being sent
                // back into the onboarding stack.
                if (result.accessToken) {
                    successToast(
                        t('peraCard.sign_in.success_title'),
                        t('peraCard.sign_in.success_body'),
                    )
                    navigation.navigate('TabBar', { screen: 'Home' })
                    return
                }

                // A non-null `phase` (with no token) means registration is
                // unfinished. Resume on the screen the server is actually
                // waiting for — the phase names the pending step, and the KYC
                // state decides whether verification must run first.
                if (result.phase) {
                    const { screen, step } = getOnboardingResumeRoute(
                        result.phase,
                        result.verificationState,
                        useCardStore.getState().contactVerificationId !== null,
                    )
                    if (step !== null) {
                        useCardStore.getState().setOnboardingStep(step)
                    }
                    if (screen === 'CardOnboardingStatus') {
                        navigation.navigate('PeraCard', {
                            screen: 'CardOnboarding',
                            params: { screen, params: {} },
                        })
                        return
                    }
                    navigation.navigate('PeraCard', {
                        screen: 'CardOnboarding',
                        params: { screen },
                    })
                    return
                }

                // No token, no code, no phase — a genuine failure.
                errorToast(
                    t('peraCard.sign_in.error_title'),
                    t('peraCard.sign_in.error_body'),
                )
            } catch (error) {
                const apiError = await getCardApiError(error)
                // A rejected OTP submission: flag a bad code for a 400/422, else
                // a generic toast (network, 5xx).
                if (otp !== undefined) {
                    if (isInvalidInputError(apiError)) {
                        setHasOtpError(true)
                        return
                    }
                    errorToast(
                        t('peraCard.sign_in.error_title'),
                        t('peraCard.sign_in.error_body'),
                    )
                    return
                }
                // A rejected credentials submission: 401/400/422 is a wrong
                // email or password, shown inline on the password field.
                if (apiError.status === 401 || isInvalidInputError(apiError)) {
                    setError('password', {
                        type: 'server',
                        message: t('peraCard.sign_in.invalid_credentials'),
                    })
                    return
                }
                errorToast(
                    t('peraCard.sign_in.error_title'),
                    t('peraCard.sign_in.error_body'),
                )
            }
        },
        [
            login,
            navigation,
            setError,
            errorToast,
            successToast,
            requestOtpCode,
            t,
        ],
    )

    const handleSignIn = useCallback(
        (submittedOtp?: string) => {
            if (isOtpRequired) {
                const code = (submittedOtp ?? otpCode).trim()
                if (code.length !== CARD_VERIFICATION_CODE_LENGTH) return
                const { email, password } = getValues()
                void performLogin(email, password, code)
                return
            }
            void handleSubmit(({ email, password }) =>
                performLogin(email, password),
            )()
        },
        [isOtpRequired, otpCode, getValues, handleSubmit, performLogin],
    )

    const handleResendOtp = useCallback(() => {
        // Re-issue the code through the dedicated OTP endpoint — no need to
        // re-run the whole login. The cooldown re-arms inside requestOtpCode
        // only if the send succeeds. Blocked while a send OR the OTP-carrying
        // login is in flight, so a fresh code can't race the verification of
        // the one being checked.
        if (!otpUserId || sendOtp.isPending || login.isPending) return
        // A fresh code is on its way — clear any "wrong code" error from the
        // prior attempt so the re-armed input starts clean.
        setHasOtpError(false)
        requestOtpCode(otpUserId)
    }, [otpUserId, sendOtp.isPending, login.isPending, requestOtpCode])

    const handleForgotPassword = useCallback(() => {
        // TODO(card): wire to the real forgot-password flow once designed.
        infoToast(
            t('peraCard.sign_in.coming_soon_title'),
            t('peraCard.sign_in.coming_soon_body'),
        )
    }, [infoToast, t])

    return {
        control,
        errors,
        isValid,
        isSubmitting: login.isPending,
        isOtpRequired,
        otpCode,
        onChangeOtp,
        isOtpValid: otpCode.trim().length === CARD_VERIFICATION_CODE_LENGTH,
        otpError: hasOtpError ? t('peraCard.sign_in.otp_invalid') : undefined,
        secondsRemaining,
        canResend: !isActive,
        handleResendOtp,
        handleSignIn,
        handleForgotPassword,
    }
}
