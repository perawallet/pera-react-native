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
import { Trans } from 'react-i18next'
import {
    getAccountDisplayName,
    useFindAccountByAddress,
} from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import { PWText } from '@components/core'
import { ConfirmActionContent } from '@components/ConfirmActionContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useWebView } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    useHandleRekeyError,
    useRekeyTransactionFeeQuery,
    useSubmitRekeyMutation,
} from '../../../shared'

import type { Decimal } from 'decimal.js'
import type { RouteProp } from '@react-navigation/native'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { RekeyToLedgerStackParamList } from '../../routes/types'

export type UseRekeyToLedgerConfirmScreenResult = {
    source: WalletAccount | null
    target: WalletAccount | null
    currentAuth: WalletAccount | null
    feeAlgos: Decimal | undefined
    feePending: boolean
    hasPreviousRekey: boolean
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
        const currentAuth = useFindAccountByAddress(source?.rekeyAddress ?? '')

        const { t } = useLanguage()
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
                navigation.navigate('RekeyToLedger', {
                    screen: 'RekeyToLedgerSuccess',
                    params: { sourceAddress: source.address },
                })
            } catch (error) {
                handleRekeyError(error)
            }
        }, [submitAsync, navigation, handleRekeyError, source, target])

        const handleLearnMore = useCallback(() => {
            pushWebView({ url: config.rekeyToLedgerSupportUrl })
        }, [pushWebView])

        const handleConfirmPress = useCallback(async () => {
            if (hasPreviousRekey) {
                const sourceName = source ? getAccountDisplayName(source) : ''
                const currentAuthName = currentAuth
                    ? getAccountDisplayName(currentAuth)
                    : ''
                const confirmed = await requestBottomSheet<boolean>({
                    contents: (
                        <ConfirmActionContent
                            icon='warning'
                            iconVariant='error'
                            title={t(
                                'rekey.to_ledger.confirm.replace_warning.title',
                            )}
                            message={
                                <PWText variant='body'>
                                    <Trans
                                        i18nKey='rekey.to_ledger.confirm.replace_warning.body'
                                        values={{
                                            currentAuth: currentAuthName,
                                            source: sourceName,
                                        }}
                                        components={[
                                            <PWText
                                                key='auth'
                                                variant='bodySemibold'
                                            />,
                                            <PWText
                                                key='source'
                                                variant='bodySemibold'
                                            />,
                                            <PWText
                                                key='learn-more'
                                                variant='link'
                                                onPress={handleLearnMore}
                                            />,
                                        ]}
                                    />
                                </PWText>
                            }
                            confirmLabel={t(
                                'rekey.to_ledger.confirm.replace_warning.confirm',
                            )}
                            cancelLabel={t(
                                'rekey.to_ledger.confirm.replace_warning.cancel',
                            )}
                            testID='rekey-to-ledger-previous-rekey-warning-sheet'
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
            t,
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
