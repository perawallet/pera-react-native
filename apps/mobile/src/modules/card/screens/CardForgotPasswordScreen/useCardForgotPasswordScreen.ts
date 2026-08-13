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
    forgotPasswordEmailSchema,
    useRequestPasswordResetMutation,
    type ForgotPasswordEmailFormValues,
} from '@perawallet/wallet-core-card'
import { trackEvent, CardEvent } from '@analytics'
import { useCardErrorToast } from '@modules/card/hooks'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { type PeraCardStackParamList } from '../../routes/types'

export type UseCardForgotPasswordScreenResult = {
    control: Control<ForgotPasswordEmailFormValues>
    errors: FieldErrors<ForgotPasswordEmailFormValues>
    isValid: boolean
    isSubmitting: boolean
    handleSendCode: () => void
}

export const useCardForgotPasswordScreen =
    (): UseCardForgotPasswordScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<RouteProp<PeraCardStackParamList, 'CardForgotPassword'>>()
        const requestReset = useRequestPasswordResetMutation()
        const showError = useCardErrorToast({
            titleKey: 'peraCard.forgot_password.error_title',
            bodyKey: 'peraCard.forgot_password.error_body',
        })

        const {
            control,
            handleSubmit,
            formState: { isValid, errors },
        } = useForm<ForgotPasswordEmailFormValues>({
            resolver: zodResolver(forgotPasswordEmailSchema),
            mode: 'onChange',
            defaultValues: { email: route.params?.email ?? '' },
        })

        const handleSendCode = useCallback(() => {
            trackEvent(CardEvent.RecoverResetRequestCode)
            void handleSubmit(async ({ email }) => {
                try {
                    await requestReset.mutateAsync({ email })
                    // Baanx answers success even for unknown emails (no
                    // account enumeration), so the flow always advances.
                    navigation.navigate('CardForgotPasswordVerify', { email })
                } catch (error) {
                    await showError(error)
                }
            })()
        }, [handleSubmit, requestReset, navigation, showError])

        return {
            control,
            errors,
            isValid,
            isSubmitting: requestReset.isPending,
            handleSendCode,
        }
    }
