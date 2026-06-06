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
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    AccountTypes,
    getAccountDisplayName,
    useFindAccountByAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import {
    useRekeyTransactionFeeQuery,
    useSubmitRekeyMutation,
} from '@perawallet/wallet-core-transactions'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useHandleRekeyError } from '../../../hooks/useHandleRekeyError'
import { PreviousRekeyWarningSheet } from '../../../components/PreviousRekeyWarningSheet'

import type { Decimal } from 'decimal.js'
import type { UndoRekeyStackParamList } from '../../../routes/undo-rekey/types'

export type UseUndoRekeyConfirmScreenResult = {
    source: WalletAccount | null
    currentAuth: WalletAccount | null
    feeAlgos: Decimal | undefined
    feePending: boolean
    isSubmitting: boolean
    handleContinuePress: () => void
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
        const handleRekeyError = useHandleRekeyError()
        const { pushWebView } = useWebView()
        const { request: requestBottomSheet } = useBottomSheet()
        const { submitAsync, isPending: isSubmitting } = useSubmitRekeyMutation(
            {
                signingMetadata: {
                    name: t('rekey.signing.source_name'),
                    description: t('rekey.signing.source_description'),
                },
            },
        )
        // Undo rekeys the account back to itself, so source and rekey-to
        // address are the same.
        const { feeAlgos, isPending: feePending } = useRekeyTransactionFeeQuery(
            sourceAddress,
            sourceAddress,
        )

        const submit = useCallback(async () => {
            if (!source) {
                // The CTA is disabled in this state, but guard anyway — a
                // dead confirm screen with no feedback is worse than a toast.
                handleRekeyError(
                    new Error('Rekey source could not be resolved'),
                )
                navigation.goBack()
                return
            }

            try {
                await submitAsync({
                    sourceAddress: source.address,
                    rekeyToAddress: source.address,
                })
                navigation.navigate('UndoRekey', {
                    screen: 'UndoRekeySuccess',
                    params: { sourceAddress: source.address },
                })
            } catch (error) {
                handleRekeyError(error)
            }
        }, [submitAsync, navigation, handleRekeyError, source])

        const handleLearnMore = useCallback(() => {
            pushWebView({ url: config.rekeyToStandardSupportUrl })
        }, [pushWebView])

        const handleContinuePress = useCallback(async () => {
            if (!source) {
                // The CTA is disabled in this state, but guard anyway — a
                // dead confirm screen with no feedback is worse than a toast.
                handleRekeyError(
                    new Error('Rekey source could not be resolved'),
                )
                navigation.goBack()
                return
            }
            const sourceName = getAccountDisplayName(source)
            const currentAuthName = currentAuth
                ? getAccountDisplayName(currentAuth)
                : ''
            const willBecomeNoAuth = source.type === AccountTypes.watch
            const i18nPrefix = willBecomeNoAuth
                ? 'rekey.undo.no_auth_warning'
                : 'rekey.undo.warning'
            const confirmed = await requestBottomSheet<boolean>({
                contents: (
                    <PreviousRekeyWarningSheet
                        i18nPrefix={i18nPrefix}
                        testID='undo-rekey-warning-sheet'
                        currentAuthName={currentAuthName}
                        sourceName={sourceName}
                        onLearnMore={handleLearnMore}
                        confirmVariant={
                            willBecomeNoAuth ? 'destructive' : 'primary'
                        }
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (!confirmed) return
            await submit()
        }, [
            source,
            currentAuth,
            requestBottomSheet,
            handleLearnMore,
            handleRekeyError,
            navigation,
            submit,
        ])

        return {
            source: source ?? null,
            currentAuth: currentAuth ?? null,
            feeAlgos,
            feePending,
            isSubmitting,
            handleContinuePress,
        }
    }
