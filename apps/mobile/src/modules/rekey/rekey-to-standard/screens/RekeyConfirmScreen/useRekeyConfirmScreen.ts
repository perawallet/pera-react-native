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
import { useAlgodErrorMessage } from '@hooks/useAlgodErrorMessage'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useModalState } from '@hooks/useModalState'
import { RekeyUserRejectedError, useSubmitRekey } from '../../../shared'

import type { RouteProp } from '@react-navigation/native'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { RekeyToStandardStackParamList } from '../../routes/types'

export type UseRekeyConfirmScreenResult = {
    source: WalletAccount | null
    target: WalletAccount | null
    currentAuth: WalletAccount | null
    feeMicroAlgos: bigint | undefined
    feePending: boolean
    hasPreviousRekey: boolean
    isSubmitting: boolean
    isWarningOpen: boolean
    handleConfirmPress: () => void
    handleWarningConfirm: () => void
    handleWarningClose: () => void
}

export const useRekeyConfirmScreen = (): UseRekeyConfirmScreenResult => {
    const navigation = useAppNavigation()
    const route =
        useRoute<
            RouteProp<RekeyToStandardStackParamList, 'RekeyToStandardConfirm'>
        >()
    const { sourceAddress, targetAddress } = route.params

    const source = useFindAccountByAddress(sourceAddress)
    const target = useFindAccountByAddress(targetAddress)
    const currentAuth = useFindAccountByAddress(source?.rekeyAddress ?? '')

    const { t } = useLanguage()
    const { showToast } = useToast()
    const { getMessage } = useAlgodErrorMessage()
    const { submitRekey } = useSubmitRekey()
    const { data: suggestedParams, isPending: feePending } =
        useSuggestedParametersQuery()

    const warning = useModalState()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const hasPreviousRekey = !!source?.rekeyAddress

    const submit = useCallback(async () => {
        if (!source || !target) return

        try {
            setIsSubmitting(true)
            await submitRekey({
                sourceAddress: source.address,
                rekeyToAddress: target.address,
            })
            navigation.navigate('RekeyToStandard', {
                screen: 'RekeyToStandardSuccess',
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
            const { title, body } = getMessage(error)
            // guardrails-ignore-next-line no-error-toast-in-catch reason: useAlgodErrorMessage already returns the localized title/body to surface
            showToast({ title, body, type: 'error' })
        } finally {
            setIsSubmitting(false)
        }
    }, [submitRekey, getMessage, navigation, showToast, source, target, t])

    const handleConfirmPress = useCallback(() => {
        if (hasPreviousRekey) {
            warning.open()
            return
        }
        void submit()
    }, [hasPreviousRekey, submit, warning])

    const handleWarningConfirm = useCallback(() => {
        warning.close()
        void submit()
    }, [submit, warning])

    const feeMicroAlgos =
        suggestedParams?.fee && suggestedParams.fee > 0n
            ? suggestedParams.fee
            : suggestedParams?.minFee

    return {
        source: source ?? null,
        target: target ?? null,
        currentAuth: currentAuth ?? null,
        feeMicroAlgos,
        feePending,
        hasPreviousRekey,
        isSubmitting,
        isWarningOpen: warning.isOpen,
        handleConfirmPress,
        handleWarningConfirm,
        handleWarningClose: warning.close,
    }
}
