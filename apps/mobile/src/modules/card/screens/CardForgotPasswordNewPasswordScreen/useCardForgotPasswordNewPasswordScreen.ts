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

import { useCallback } from 'react'
import { useForm, type Control, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    getCardApiError,
    isInvalidInputError,
    passwordSetSchema,
    useConfirmPasswordResetMutation,
    type PasswordSetFormValues,
} from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import { useCardErrorToast } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import type { PeraCardStackParamList } from '../../routes/types'

export type UseCardForgotPasswordNewPasswordScreenResult = {
    control: Control<PasswordSetFormValues>
    errors: FieldErrors<PasswordSetFormValues>
    /** Current password value, drives the live requirements checklist. */
    password: string
    isValid: boolean
    isSubmitting: boolean
    handleConfirm: () => void
}

export const useCardForgotPasswordNewPasswordScreen =
    (): UseCardForgotPasswordNewPasswordScreenResult => {
        const { t } = useLanguage()
        const { successToast, errorToast } = useToast()
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<
                    PeraCardStackParamList,
                    'CardForgotPasswordNewPassword'
                >
            >()
        const { email, token } = route.params
        const confirmReset = useConfirmPasswordResetMutation()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.forgot_password.error_title',
            bodyKey: 'peraCard.forgot_password.error_body',
        })

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

        const handleConfirm = useCallback(() => {
            void handleSubmit(async ({ password, confirmPassword }) => {
                try {
                    await confirmReset.mutateAsync({
                        token,
                        password,
                        confirmPassword,
                    })
                    trackEvent(CardEvent.RecoverResetComplete)
                    successToast(
                        t('peraCard.forgot_password.success_title'),
                        t('peraCard.forgot_password.success_body'),
                    )
                    // Pops back to the existing CardSignIn instance and hands
                    // the email back for prefill.
                    navigation.navigate('CardSignIn', { email })
                } catch (error) {
                    const apiError = await getCardApiError(error)
                    // A 400/422 here most plausibly means the single-use token
                    // expired (the password already passed the same rules
                    // client-side): explain, then return to the code screen
                    // where resend can mint a fresh one. Baanx's message is
                    // preferred when present (it may instead be a server-side
                    // password rejection, e.g. a common password).
                    if (isInvalidInputError(apiError)) {
                        errorToast(
                            t('peraCard.forgot_password.confirm_failed_title'),
                            apiError.message ??
                                t(
                                    'peraCard.forgot_password.token_expired_body',
                                ),
                        )
                        navigation.goBack()
                        return
                    }
                    await showError(error, apiError)
                }
            })()
        }, [
            handleSubmit,
            confirmReset,
            token,
            email,
            navigation,
            successToast,
            errorToast,
            showError,
            t,
        ])

        return {
            control,
            errors,
            password,
            isValid,
            isSubmitting: confirmReset.isPending,
            handleConfirm,
        }
    }
