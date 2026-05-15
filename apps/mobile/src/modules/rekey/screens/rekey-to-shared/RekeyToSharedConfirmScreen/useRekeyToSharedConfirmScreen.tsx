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

import { useCallback } from 'react'
import { useRoute } from '@react-navigation/native'
import {
    getAccountDisplayName,
    useFindAccountByAddress,
} from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    useRekeyTransactionFeeQuery,
    useSubmitRekeyMutation,
} from '../../../shared'
import { useHandleRekeyError } from '../../../hooks/useHandleRekeyError'
import { PreviousRekeyWarningSheet } from '../../../components/PreviousRekeyWarningSheet'

import type { Decimal } from 'decimal.js'
import type { RouteProp } from '@react-navigation/native'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { RekeyToSharedStackParamList } from '../../../routes/rekey-to-shared/types'

export type UseRekeyToSharedConfirmScreenResult = {
    source: WalletAccount | null
    target: WalletAccount | null
    currentAuth: WalletAccount | null
    feeAlgos: Decimal | undefined
    feePending: boolean
    hasPreviousRekey: boolean
    isSubmitting: boolean
    handleConfirmPress: () => void
}

export const useRekeyToSharedConfirmScreen =
    (): UseRekeyToSharedConfirmScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<RekeyToSharedStackParamList, 'RekeyToSharedConfirm'>
            >()
        const { sourceAddress, targetAddress } = route.params

        const source = useFindAccountByAddress(sourceAddress)
        const target = useFindAccountByAddress(targetAddress)
        const currentAuth = useFindAccountByAddress(source?.rekeyAddress ?? '')

        const handleRekeyError = useHandleRekeyError()
        const { pushWebView } = useWebView()
        const { request: requestBottomSheet } = useBottomSheet()
        const { submitAsync, isPending: isSubmitting } =
            useSubmitRekeyMutation()
        const { feeAlgos, isPending: feePending } = useRekeyTransactionFeeQuery(
            sourceAddress,
            targetAddress,
        )

        const hasPreviousRekey = !!source?.rekeyAddress

        const submit = useCallback(async () => {
            if (!source || !target) {
                // The CTA is disabled in this state, but guard anyway — a
                // dead confirm screen with no feedback is worse than a toast.
                handleRekeyError(
                    new Error('Rekey source or target could not be resolved'),
                )
                navigation.goBack()
                return
            }

            try {
                await submitAsync({
                    sourceAddress: source.address,
                    rekeyToAddress: target.address,
                })
                navigation.navigate('RekeyToShared', {
                    screen: 'RekeyToSharedSuccess',
                    params: { sourceAddress: source.address },
                })
            } catch (error) {
                handleRekeyError(error)
            }
        }, [submitAsync, navigation, handleRekeyError, source, target])

        const handleLearnMore = useCallback(() => {
            pushWebView({ url: config.rekeyToSharedSupportUrl })
        }, [pushWebView])

        const handleConfirmPress = useCallback(async () => {
            if (hasPreviousRekey) {
                const sourceName = source ? getAccountDisplayName(source) : ''
                const currentAuthName = currentAuth
                    ? getAccountDisplayName(currentAuth)
                    : ''
                const confirmed = await requestBottomSheet<boolean>({
                    contents: (
                        <PreviousRekeyWarningSheet
                            i18nPrefix='rekey.to_shared.confirm.replace_warning'
                            testID='rekey-to-shared-previous-rekey-warning-sheet'
                            currentAuthName={currentAuthName}
                            sourceName={sourceName}
                            onLearnMore={handleLearnMore}
                        />
                    ),
                    options: { size: 'auto', enablePanDownToClose: true },
                })
                if (!confirmed) return
            }
            await submit()
        }, [
            hasPreviousRekey,
            source,
            currentAuth,
            requestBottomSheet,
            handleLearnMore,
            submit,
        ])

        return {
            source: source ?? null,
            target: target ?? null,
            currentAuth: currentAuth ?? null,
            feeAlgos,
            feePending,
            hasPreviousRekey,
            isSubmitting,
            handleConfirmPress,
        }
    }
