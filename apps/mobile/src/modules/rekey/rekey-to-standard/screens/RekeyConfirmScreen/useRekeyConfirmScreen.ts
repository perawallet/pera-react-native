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
import {
    useAlgorandClient,
    useSuggestedParametersQuery,
} from '@perawallet/wallet-core-blockchain'
import { useFindAccountByAddress } from '@perawallet/wallet-core-accounts'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useModalState } from '@hooks/useModalState'

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
    const { signTransactions } = useTransactionSigner()
    const algokit = useAlgorandClient(signTransactions)
    const { data: suggestedParams, isPending: feePending } =
        useSuggestedParametersQuery()

    const warning = useModalState()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const hasPreviousRekey = !!source?.rekeyAddress

    const submit = useCallback(async () => {
        if (!source || !target) return

        try {
            setIsSubmitting(true)
            await algokit.send.payment({
                sender: source.address,
                receiver: source.address,
                amount: 0n.microAlgo(),
                rekeyTo: target.address,
            })
            // TODO: navigate to RekeyToStandardSuccess once that screen lands.
            navigation.goBack()
        } catch (error) {
            // guardrails-ignore-next-line no-error-toast-in-catch reason: surface raw algod error message verbatim with localized title for diagnosability
            showToast({
                title: t('rekey.to_standard.confirm.error_title'),
                body:
                    error instanceof Error
                        ? error.message
                        : t('rekey.to_standard.confirm.error_body'),
                type: 'error',
            })
        } finally {
            setIsSubmitting(false)
        }
    }, [algokit, navigation, showToast, source, t, target])

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

    return {
        source: source ?? null,
        target: target ?? null,
        currentAuth: currentAuth ?? null,
        feeMicroAlgos: suggestedParams?.fee,
        feePending,
        hasPreviousRekey,
        isSubmitting,
        isWarningOpen: warning.isOpen,
        handleConfirmPress,
        handleWarningConfirm,
        handleWarningClose: warning.close,
    }
}
