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
    useCardStore,
    useSendPhoneVerificationMutation,
    useVerifyPhoneMutation,
} from '@perawallet/wallet-core-card'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCountdown } from '@hooks/useCountdown'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import {
    CARD_VERIFICATION_CODE_LENGTH,
    MOCK_VALID_VERIFICATION_CODE,
} from '../cardVerificationConstants'

/** Seconds the user must wait before the SMS code can be re-sent. */
const RESEND_COOLDOWN_SECONDS = 60

export type UseCardOnboardingPhoneVerifyScreenResult = {
    code: string
    onChangeCode: (text: string) => void
    isValid: boolean
    isWrongCode: boolean
    isSubmitting: boolean
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
        const navigation = useAppNavigation()
        const phoneCountryCode = useCardStore(state => state.phoneCountryCode)
        const phoneNumber = useCardStore(state => state.phoneNumber)
        const onboardingId = useCardStore(state => state.onboardingId)
        const contactVerificationId = useCardStore(
            state => state.contactVerificationId,
        )
        const sendPhoneVerification = useSendPhoneVerificationMutation()
        const verifyPhone = useVerifyPhoneMutation()

        const [code, setCode] = useState('')
        const [isWrongCode, setIsWrongCode] = useState(false)
        const { secondsRemaining, isActive, restart } = useCountdown(
            RESEND_COOLDOWN_SECONDS,
        )

        const trimmedCode = code.trim()
        const phoneDisplay =
            phoneCountryCode && phoneNumber
                ? `+${phoneCountryCode} ${phoneNumber}`
                : ''

        const onChangeCode = useCallback((text: string) => {
            setCode(text)
            setIsWrongCode(false)
        }, [])

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
                    setIsWrongCode(false)
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

        // Local pre-check for fast feedback, then the real (mocked) verify call.
        const handleConfirm = useCallback(
            (submittedCode?: string) => {
                const value = (submittedCode ?? code).trim()
                if (!value) return
                if (value.toUpperCase() !== MOCK_VALID_VERIFICATION_CODE) {
                    setIsWrongCode(true)
                    return
                }
                const confirm = async () => {
                    if (
                        onboardingId === null ||
                        phoneCountryCode === null ||
                        phoneNumber === null ||
                        contactVerificationId === null
                    ) {
                        errorToast(
                            t('peraCard.verify_phone.verify_error_title'),
                            t('peraCard.verify_phone.verify_error_body'),
                        )
                        navigation.navigate('CardOnboardingEmailVerify')
                        return
                    }
                    try {
                        await verifyPhone.mutateAsync({
                            onboardingId,
                            phoneCountryCode,
                            phoneNumber,
                            contactVerificationId,
                            verificationCode: value,
                        })
                        navigation.navigate('CardOnboardingPersonalDetails')
                    } catch {
                        errorToast(
                            t('peraCard.verify_phone.verify_error_title'),
                            t('peraCard.verify_phone.verify_error_body'),
                        )
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
                verifyPhone,
                errorToast,
                navigation,
                t,
            ],
        )

        return {
            code,
            onChangeCode,
            isValid: trimmedCode.length === CARD_VERIFICATION_CODE_LENGTH,
            isWrongCode,
            isSubmitting: verifyPhone.isPending,
            phoneDisplay,
            secondsRemaining,
            canResend: !isActive,
            handleResend,
            handleConfirm,
        }
    }
