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
import { useRoute } from '@react-navigation/native'
import { useSuggestedParametersQuery } from '@perawallet/wallet-core-blockchain'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { useErrorToast } from '@hooks/useErrorToast'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useModalState } from '@hooks/useModalState'
import { RekeyUserRejectedError, useSubmitRekey } from '../../../shared'

import type { RouteProp } from '@react-navigation/native'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { UndoRekeyStackParamList } from '../../routes/types'

export type UseUndoRekeyConfirmScreenResult = {
    source: WalletAccount | null
    currentAuth: WalletAccount | null
    feeMicroAlgos: bigint | undefined
    feePending: boolean
    isSubmitting: boolean
    isWarningOpen: boolean
    handleContinuePress: () => void
    handleWarningConfirm: () => void
    handleWarningClose: () => void
}

export const useUndoRekeyConfirmScreen =
    (): UseUndoRekeyConfirmScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<RouteProp<UndoRekeyStackParamList, 'UndoRekeyConfirm'>>()
        const { sourceAddress } = route.params

        const source = useFindAccountByAddress(sourceAddress)
        const currentAuth = useFindAccountByAddress(source?.rekeyAddress ?? '')

        const { t } = useLanguage()
        const { showToast } = useToast()
        const { showError } = useErrorToast()
        const { submitRekey } = useSubmitRekey()
        const { data: suggestedParams, isPending: feePending } =
            useSuggestedParametersQuery()

        const warning = useModalState()
        const [isSubmitting, setIsSubmitting] = useState(false)

        const submit = useCallback(async () => {
            if (!source) return

            try {
                setIsSubmitting(true)
                await submitRekey({
                    sourceAddress: source.address,
                    rekeyToAddress: source.address,
                })
                navigation.navigate('UndoRekey', {
                    screen: 'UndoRekeySuccess',
                    params: { sourceAddress: source.address },
                })
            } catch (error) {
                if (error instanceof RekeyUserRejectedError) {
                    // guardrails-ignore-next-line no-error-toast-in-catch reason: rejection is a user-facing cancellation, distinct from algod errors
                    showToast({
                        title: t('rekey.signing.user_rejected_title'),
                        body: t('rekey.signing.user_rejected_body'),
                        type: 'error',
                    })
                    return
                }
                showError(error)
            } finally {
                setIsSubmitting(false)
            }
        }, [submitRekey, navigation, showError, showToast, source, t])

        const handleContinuePress = useCallback(() => {
            warning.open()
        }, [warning])

        const handleWarningConfirm = useCallback(() => {
            warning.close()
            void submit()
        }, [submit, warning])

        const feeMicroAlgos = suggestedParams?.minFee

        return {
            source: source ?? null,
            currentAuth: currentAuth ?? null,
            feeMicroAlgos,
            feePending,
            isSubmitting,
            isWarningOpen: warning.isOpen,
            handleContinuePress,
            handleWarningConfirm,
            handleWarningClose: warning.close,
        }
    }
