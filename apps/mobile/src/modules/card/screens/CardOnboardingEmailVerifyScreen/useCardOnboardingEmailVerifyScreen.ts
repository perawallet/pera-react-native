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
    OnboardingStep,
    useCardStore,
    useSendEmailVerificationMutation,
} from '@perawallet/wallet-core-card'
import { useCountdown } from '@hooks/useCountdown'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

/** Seconds the user must wait before the verification email can be re-sent. */
const RESEND_COOLDOWN_SECONDS = 60

/**
 * Dev-only stand-in for the real verification code. Until the Baanx verify
 * contract is wired up, a code matching this (case-insensitive) is treated as
 * correct and anything else surfaces the "wrong code" error.
 */
export const MOCK_VALID_VERIFICATION_CODE = 'PERA123'

type UseCardOnboardingEmailVerifyScreenParams = {
    email: string
}

export type UseCardOnboardingEmailVerifyScreenResult = {
    code: string
    onChangeCode: (text: string) => void
    isValid: boolean
    isWrongCode: boolean
    secondsRemaining: number
    canResend: boolean
    handleResend: () => void
    handleConfirm: () => void
}

export const useCardOnboardingEmailVerifyScreen = ({
    email,
}: UseCardOnboardingEmailVerifyScreenParams): UseCardOnboardingEmailVerifyScreenResult => {
    const { t } = useLanguage()
    const { successToast, errorToast } = useToast()
    const setOnboardingStep = useCardStore(state => state.setOnboardingStep)
    const sendEmailVerification = useSendEmailVerificationMutation()

    const [code, setCode] = useState('')
    const [isWrongCode, setIsWrongCode] = useState(false)
    const { secondsRemaining, isActive, restart } = useCountdown(
        RESEND_COOLDOWN_SECONDS,
    )

    const trimmedCode = code.trim()

    const onChangeCode = useCallback((text: string) => {
        setCode(text)
        setIsWrongCode(false)
    }, [])

    const handleResend = useCallback(() => {
        // Guard against duplicate sends from a double-tap while the request is
        // in flight (the link stays visible until the cooldown restarts).
        if (sendEmailVerification.isPending) return
        const resend = async () => {
            try {
                await sendEmailVerification.mutateAsync({ email })
                restart()
                setIsWrongCode(false)
            } catch {
                errorToast(
                    t('peraCard.create_account.error_title'),
                    t('peraCard.create_account.error_body'),
                )
            }
        }
        void resend()
    }, [sendEmailVerification, email, restart, errorToast, t])

    // TODO(card): replace this simulated check with useVerifyEmailMutation once
    // the backend contract (password + contactVerificationId capture) is confirmed.
    const handleConfirm = useCallback(() => {
        if (!trimmedCode) return
        if (trimmedCode.toUpperCase() !== MOCK_VALID_VERIFICATION_CODE) {
            setIsWrongCode(true)
            return
        }
        setOnboardingStep(OnboardingStep.PhoneSend)
        successToast(
            t('peraCard.verify_email.success_title'),
            t('peraCard.verify_email.success_body'),
        )
    }, [trimmedCode, setOnboardingStep, successToast, t])

    return {
        code,
        onChangeCode,
        isValid: trimmedCode.length > 0,
        isWrongCode,
        secondsRemaining,
        canResend: !isActive,
        handleResend,
        handleConfirm,
    }
}
