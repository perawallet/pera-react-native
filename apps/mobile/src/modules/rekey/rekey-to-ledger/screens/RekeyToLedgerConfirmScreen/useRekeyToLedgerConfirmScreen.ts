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
import { useAlgodErrorMessage } from '@hooks/useAlgodErrorMessage'
import { useToast } from '@hooks/useToast'
import { useAppNavigation } from '@hooks/useAppNavigation'

import type { RouteProp } from '@react-navigation/native'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { RekeyToLedgerStackParamList } from '../../routes/types'

export type UseRekeyToLedgerConfirmScreenResult = {
    source: WalletAccount | null
    target: WalletAccount | null
    feeMicroAlgos: bigint | undefined
    feePending: boolean
    isSubmitting: boolean
    handleConfirmPress: () => void
}

export const useRekeyToLedgerConfirmScreen =
    (): UseRekeyToLedgerConfirmScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<RekeyToLedgerStackParamList, 'RekeyToLedgerConfirm'>
            >()
        const { sourceAddress, targetAddress } = route.params

        const source = useFindAccountByAddress(sourceAddress)
        const target = useFindAccountByAddress(targetAddress)

        const { showToast } = useToast()
        const { getMessage } = useAlgodErrorMessage()
        const { signTransactions } = useTransactionSigner()
        const algokit = useAlgorandClient(signTransactions)
        const { data: suggestedParams, isPending: feePending } =
            useSuggestedParametersQuery()

        const [isSubmitting, setIsSubmitting] = useState(false)

        const handleConfirmPress = useCallback(async () => {
            if (!source || !target) return

            try {
                setIsSubmitting(true)
                await algokit.send.payment({
                    sender: source.address,
                    receiver: source.address,
                    amount: (0n).microAlgo(),
                    rekeyTo: target.address,
                })
                navigation.navigate('RekeyToLedger', {
                    screen: 'RekeyToLedgerSuccess',
                    params: { sourceAddress: source.address },
                })
            } catch (error) {
                const { title, body } = getMessage(error)
                showToast({ title, body, type: 'error' })
            } finally {
                setIsSubmitting(false)
            }
        }, [algokit, getMessage, navigation, showToast, source, target])

        const feeMicroAlgos =
            suggestedParams?.fee && suggestedParams.fee > 0n
                ? suggestedParams.fee
                : suggestedParams?.minFee

        return {
            source: source ?? null,
            target: target ?? null,
            feeMicroAlgos,
            feePending,
            isSubmitting,
            handleConfirmPress,
        }
    }
