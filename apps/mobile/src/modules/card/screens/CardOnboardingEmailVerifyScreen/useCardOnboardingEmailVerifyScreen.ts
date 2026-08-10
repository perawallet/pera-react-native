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
import {
    useCardStore,
    useSendEmailVerificationMutation,
} from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCountdown } from '@hooks/useCountdown'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { CARD_VERIFICATION_CODE_LENGTH } from '../cardVerificationConstants'

/** Seconds the user must wait before the verification email can be re-sent. */
const RESEND_COOLDOWN_SECONDS = 60

export type UseCardOnboardingEmailVerifyScreenResult = {
    code: string
    /** The address the code was sent to, shown in the screen copy. */
    email: string
    onChangeCode: (text: string) => void
    isValid: boolean
    /** Set when a prior attempt rejected the code; shown inline on the input. */
    codeError?: string
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

export const useCardOnboardingEmailVerifyScreen =
    (): UseCardOnboardingEmailVerifyScreenResult => {
        const { t } = useLanguage()
        const { errorToast } = useToast()
        const navigation = useAppNavigation()
        const sendEmailVerification = useSendEmailVerificationMutation()
        const email = useCardStore(state => state.email)
        const setVerificationCode = useCardStore(
            state => state.setVerificationCode,
        )
        const codeVerificationError = useCardStore(
            state => state.codeVerificationError,
        )
        const setCodeVerificationError = useCardStore(
            state => state.setCodeVerificationError,
        )

        const [code, setCode] = useState('')
        const { secondsRemaining, isActive, restart } = useCountdown(
            RESEND_COOLDOWN_SECONDS,
        )

        const trimmedCode = code.trim()
        const codeError =
            codeVerificationError === 'email'
                ? t('peraCard.verify_email.code_invalid')
                : undefined

        const onChangeCode = useCallback(
            (text: string) => {
                setCode(text)
                // Editing clears the "code invalid" flag from a failed attempt.
                if (codeVerificationError) setCodeVerificationError(null)
            },
            [codeVerificationError, setCodeVerificationError],
        )

        const handleResend = useCallback(() => {
            // Guard against duplicate sends from a double-tap while the request
            // is in flight (the link stays visible until the cooldown restarts).
            if (sendEmailVerification.isPending) return
            trackEvent(CardEvent.CreateEmailVerifySendAgain)
            const resend = async () => {
                try {
                    await sendEmailVerification.mutateAsync({
                        email: email ?? '',
                    })
                    restart()
                } catch {
                    errorToast(
                        t('peraCard.create_account.error_title'),
                        t('peraCard.create_account.error_body'),
                    )
                }
            }
            void resend()
        }, [sendEmailVerification, email, restart, errorToast, t])

        // This screen can't validate the code itself: the real email/verify
        // (which also sets the password) only fires on the password screen — the
        // very next step. So the full code is stashed for it to submit while the
        // code is still fresh; a wrong code surfaces there.
        const handleConfirm = useCallback(
            (submittedCode?: string) => {
                const value = (submittedCode ?? code).trim()
                if (value.length !== CARD_VERIFICATION_CODE_LENGTH) return
                trackEvent(CardEvent.CreateEmailVerification)
                setVerificationCode(value)
                navigation.navigate('CardOnboardingPassword')
            },
            [code, navigation, setVerificationCode],
        )

        return {
            code,
            email: email ?? '',
            onChangeCode,
            isValid: trimmedCode.length === CARD_VERIFICATION_CODE_LENGTH,
            codeError,
            secondsRemaining,
            canResend: !isActive,
            handleResend,
            handleConfirm,
        }
    }
