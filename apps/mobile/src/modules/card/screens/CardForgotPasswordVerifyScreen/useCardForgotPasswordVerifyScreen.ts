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
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    getCardApiError,
    isInvalidInputError,
    useRequestPasswordResetMutation,
    useVerifyPasswordResetMutation,
} from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import { useCardErrorToast } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useCountdown } from '@hooks/useCountdown'
import { useLanguage } from '@hooks/useLanguage'
import { CARD_VERIFICATION_CODE_LENGTH } from '../cardVerificationConstants'
import { type PeraCardStackParamList } from '../../routes/types'

/** Seconds the user must wait before the reset code can be re-requested. */
const RESEND_COOLDOWN_SECONDS = 60

export type UseCardForgotPasswordVerifyScreenResult = {
    code: string
    /** The address the code was sent to, shown in the screen copy. */
    email: string
    onChangeCode: (text: string) => void
    isValid: boolean
    /** Set when a prior attempt rejected the code; shown inline on the input. */
    codeError?: string
    isSubmitting: boolean
    secondsRemaining: number
    canResend: boolean
    handleResend: () => void
    /**
     * `submittedCode` is passed by `PWCodeInput`'s `onComplete` (auto-submit),
     * carrying the just-completed value because `code` state hasn't
     * re-rendered yet. The button/keyboard call it with no arg.
     */
    handleVerify: (submittedCode?: string) => void
}

export const useCardForgotPasswordVerifyScreen =
    (): UseCardForgotPasswordVerifyScreenResult => {
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<PeraCardStackParamList, 'CardForgotPasswordVerify'>
            >()
        const { email } = route.params
        const requestReset = useRequestPasswordResetMutation()
        const verifyReset = useVerifyPasswordResetMutation()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.forgot_password.error_title',
            bodyKey: 'peraCard.forgot_password.error_body',
        })

        const [code, setCode] = useState('')
        const [hasCodeError, setHasCodeError] = useState(false)
        // Auto-starts armed: the previous screen just sent the code.
        const { secondsRemaining, isActive, restart } = useCountdown(
            RESEND_COOLDOWN_SECONDS,
        )

        const onChangeCode = useCallback(
            (text: string) => {
                setCode(text)
                // Editing clears the "code invalid" flag from a failed attempt.
                if (hasCodeError) setHasCodeError(false)
            },
            [hasCodeError],
        )

        const handleResend = useCallback(() => {
            // Blocked while a send OR the verify is in flight, so a fresh code
            // can't race the verification of the one being checked. The
            // cooldown re-arms only when the send succeeds.
            if (requestReset.isPending || verifyReset.isPending) return
            trackEvent(CardEvent.RecoverResetRequestCode)
            setHasCodeError(false)
            requestReset
                .mutateAsync({ email })
                .then(() => restart())
                .catch(async error => {
                    await showError(error)
                })
        }, [requestReset, verifyReset.isPending, email, restart, showError])

        const handleVerify = useCallback(
            (submittedCode?: string) => {
                const value = (submittedCode ?? code).trim()
                if (value.length !== CARD_VERIFICATION_CODE_LENGTH) return
                trackEvent(CardEvent.RecoverResetVerifyCode)
                const verify = async () => {
                    try {
                        const token = await verifyReset.mutateAsync({
                            email,
                            code: value,
                        })
                        navigation.navigate('CardForgotPasswordNewPassword', {
                            email,
                            token,
                        })
                    } catch (error) {
                        const apiError = await getCardApiError(error)
                        // A 400/422 is a wrong or expired code, shown inline;
                        // anything else (network, 5xx) gets the toast.
                        if (isInvalidInputError(apiError)) {
                            setHasCodeError(true)
                            return
                        }
                        await showError(error, apiError)
                    }
                }
                void verify()
            },
            [code, email, verifyReset, navigation, showError],
        )

        return {
            code,
            email,
            onChangeCode,
            isValid: code.trim().length === CARD_VERIFICATION_CODE_LENGTH,
            codeError: hasCodeError
                ? t('peraCard.forgot_password.code_invalid')
                : undefined,
            isSubmitting: verifyReset.isPending,
            secondsRemaining,
            canResend: !isActive,
            handleResend,
            handleVerify,
        }
    }
