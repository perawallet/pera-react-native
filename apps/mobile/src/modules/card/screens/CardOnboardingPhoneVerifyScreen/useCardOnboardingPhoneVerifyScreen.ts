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
import {
    getCardApiError,
    isInvalidInputError,
    useCardStore,
    useSendPhoneVerificationMutation,
    useVerifyPhoneMutation,
} from '@perawallet/wallet-core-card'
import { useCardErrorToast } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCountdown } from '@hooks/useCountdown'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { CARD_VERIFICATION_CODE_LENGTH } from '../cardVerificationConstants'

/** Seconds the user must wait before the SMS code can be re-sent. */
const RESEND_COOLDOWN_SECONDS = 60

export type UseCardOnboardingPhoneVerifyScreenResult = {
    code: string
    onChangeCode: (text: string) => void
    isValid: boolean
    isSubmitting: boolean
    /** Set when a prior attempt rejected the code; shown inline on the input. */
    codeError?: string
    /** The phone the code was sent to, formatted as `+44 7400846282`. */
    phoneDisplay: string
    secondsRemaining: number
    canResend: boolean
    handleResend: () => void
    /**
     * `submittedCode` is passed by `PWCodeInput`'s `onComplete` (auto-submit),
     * carrying the just-completed value because `code` state hasn't re-rendered
     * yet. The button/keyboard call it with no arg and use the settled state.
     */
    handleConfirm: (submittedCode?: string) => void
}

export const useCardOnboardingPhoneVerifyScreen =
    (): UseCardOnboardingPhoneVerifyScreenResult => {
        const { t } = useLanguage()
        const { errorToast } = useToast()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.verify_phone.verify_error_title',
            bodyKey: 'peraCard.verify_phone.verify_error_body',
        })
        const navigation = useAppNavigation()
        const phoneCountryCode = useCardStore(state => state.phoneCountryCode)
        const phoneNumber = useCardStore(state => state.phoneNumber)
        const onboardingId = useCardStore(state => state.onboardingId)
        const contactVerificationId = useCardStore(
            state => state.contactVerificationId,
        )
        const codeVerificationError = useCardStore(
            state => state.codeVerificationError,
        )
        const setCodeVerificationError = useCardStore(
            state => state.setCodeVerificationError,
        )
        const sendPhoneVerification = useSendPhoneVerificationMutation()
        const verifyPhone = useVerifyPhoneMutation()

        const [code, setCode] = useState('')
        const { secondsRemaining, isActive, restart } = useCountdown(
            RESEND_COOLDOWN_SECONDS,
        )

        const trimmedCode = code.trim()
        const codeError =
            codeVerificationError === 'phone'
                ? t('peraCard.verify_phone.code_invalid')
                : undefined
        const phoneDisplay =
            phoneCountryCode && phoneNumber
                ? `+${phoneCountryCode} ${phoneNumber}`
                : ''

        const onChangeCode = useCallback(
            (text: string) => {
                setCode(text)
                // Editing clears the "code invalid" flag from a failed attempt.
                if (codeVerificationError) setCodeVerificationError(null)
            },
            [codeVerificationError, setCodeVerificationError],
        )

        const handleResend = useCallback(() => {
            // Guard against duplicate sends from a double-tap while in flight.
            if (sendPhoneVerification.isPending) return
            if (
                phoneCountryCode === null ||
                phoneNumber === null ||
                contactVerificationId === null
            ) {
                return
            }
            const resend = async () => {
                try {
                    await sendPhoneVerification.mutateAsync({
                        phoneCountryCode,
                        phoneNumber,
                        contactVerificationId,
                    })
                    restart()
                } catch {
                    errorToast(
                        t('peraCard.verify_phone.send_error_title'),
                        t('peraCard.verify_phone.send_error_body'),
                    )
                }
            }
            void resend()
        }, [
            sendPhoneVerification,
            phoneCountryCode,
            phoneNumber,
            contactVerificationId,
            restart,
            errorToast,
            t,
        ])

        // email/verify (which issues the onboardingId phone/verify needs) runs
        // on the password screen, before these phone steps — so the onboardingId
        // is already set and the code is verified directly with a fresh OTP.
        const handleConfirm = useCallback(
            (submittedCode?: string) => {
                const value = (submittedCode ?? code).trim()
                if (value.length !== CARD_VERIFICATION_CODE_LENGTH) return
                if (
                    phoneCountryCode === null ||
                    phoneNumber === null ||
                    contactVerificationId === null
                ) {
                    errorToast(
                        t('peraCard.verify_phone.verify_error_title'),
                        t('peraCard.verify_phone.verify_error_body'),
                    )
                    navigation.navigate('CardOnboardingPhone')
                    return
                }
                if (onboardingId === null) {
                    // Shouldn't happen (the password step sets it), but without
                    // it phone/verify can't run — send the user back to it.
                    errorToast(
                        t('peraCard.verify_phone.verify_error_title'),
                        t('peraCard.verify_phone.verify_error_body'),
                    )
                    navigation.navigate('CardOnboardingPassword')
                    return
                }
                const confirm = async () => {
                    try {
                        await verifyPhone.mutateAsync({
                            onboardingId,
                            phoneCountryCode,
                            phoneNumber,
                            contactVerificationId,
                            verificationCode: value,
                        })
                        // Phone verified: KYC (identity verification) is next.
                        navigation.navigate('CardOnboardingVerification')
                    } catch (error) {
                        // A 400/422 means the code itself was wrong/expired —
                        // surface it inline. Anything else (network, 5xx) isn't
                        // the code's fault, so show the generic toast rather
                        // than mislabeling it as a bad code.
                        const apiError = await getCardApiError(error)
                        if (isInvalidInputError(apiError)) {
                            setCodeVerificationError('phone')
                        } else {
                            await showError(error, apiError)
                        }
                    }
                }
                void confirm()
            },
            [
                code,
                onboardingId,
                phoneCountryCode,
                phoneNumber,
                contactVerificationId,
                setCodeVerificationError,
                verifyPhone,
                errorToast,
                showError,
                navigation,
                t,
            ],
        )

        return {
            code,
            onChangeCode,
            isValid: trimmedCode.length === CARD_VERIFICATION_CODE_LENGTH,
            isSubmitting: verifyPhone.isPending,
            codeError,
            phoneDisplay,
            secondsRemaining,
            canResend: !isActive,
            handleResend,
            handleConfirm,
        }
    }
