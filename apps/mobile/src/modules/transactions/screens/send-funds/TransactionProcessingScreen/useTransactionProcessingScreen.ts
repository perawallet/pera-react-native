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

import { useEffect, useRef } from 'react'
import { BackHandler } from 'react-native'

import { bottomSheetNotifier } from '@components/core'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import {
    ALGO_ASSET,
    ALGO_ASSET_ID,
    toDecimalUnits,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useArc59Transaction } from '@perawallet/wallet-core-asa-inbox'
import {
    useAlgorandClient,
    useExpressTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'
import { t } from 'i18next'

export const useTransactionProcessingScreen = () => {
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const {
        selectedAsset,
        amount,
        destination,
        note,
        sendMode,
        arc59Summary,
        isCloseAccount,
    } = useSendFunds()
    const { signTransactions } = useTransactionSigner()
    const algokit = useAlgorandClient(signTransactions)
    const { sendViaInbox } = useArc59Transaction(signTransactions)
    const { sendExpress } = useExpressTransaction(signTransactions)
    const selectedAccount = useSelectedAccount()
    const { data: assets } = useAssetsQuery()
    const { showToast } = useToast()
    const hasExecuted = useRef(false)

    const asset = selectedAsset?.assetId
        ? assets.get(selectedAsset.assetId)
        : null

    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => true,
        )
        return () => subscription.remove()
    }, [])

    useEffect(() => {
        if (hasExecuted.current) return
        hasExecuted.current = true

        const execute = async () => {
            if (
                !selectedAccount ||
                !selectedAsset ||
                !destination ||
                !amount ||
                !asset
            ) {
                showToast(
                    {
                        title: t('transactions.invalid_title'),
                        body: t('transactions.invalid_body'),
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                navigation.goBack()
                return
            }

            try {
                let txId: string

                switch (sendMode) {
                    case 'express': {
                        const expressResult = await sendExpress({
                            sender: selectedAccount.address,
                            receiver: destination,
                            assetId: BigInt(selectedAsset.assetId),
                            amount: BigInt(
                                toDecimalUnits(amount, asset).toString(),
                            ),
                        })
                        txId =
                            expressResult.txIds[expressResult.txIds.length - 1]
                        break
                    }
                    case 'arc59': {
                        if (arc59Summary) {
                            const arc59Result = await sendViaInbox({
                                sender: selectedAccount.address,
                                receiver: destination,
                                assetId: BigInt(selectedAsset.assetId),
                                amount: BigInt(
                                    toDecimalUnits(amount, asset).toString(),
                                ),
                                summary: arc59Summary,
                            })
                            txId =
                                arc59Result.txIds[arc59Result.txIds.length - 1]
                        } else {
                            throw new Error(
                                'Missing ARC59 summary for ARC59 transaction',
                            )
                        }
                        break
                    }
                    case 'normal': {
                        if (selectedAsset.assetId === ALGO_ASSET_ID) {
                            const result = await algokit.send.payment({
                                sender: selectedAccount.address,
                                receiver: destination,
                                amount: isCloseAccount
                                    ? BigInt(0).microAlgo()
                                    : BigInt(
                                          toDecimalUnits(
                                              amount,
                                              ALGO_ASSET,
                                          ).toString(),
                                      ).microAlgo(),
                                ...(isCloseAccount && {
                                    closeRemainderTo: destination,
                                }),
                                note,
                            })
                            txId = result.txIds[0]
                        } else {
                            const result = await algokit.send.assetTransfer({
                                sender: selectedAccount.address,
                                receiver: destination,
                                amount: BigInt(
                                    toDecimalUnits(amount, asset).toString(),
                                ),
                                assetId: BigInt(selectedAsset.assetId),
                                note,
                            })
                            txId = result.txIds[0]
                        }
                        break
                    }
                }

                navigation.replace('TransactionSuccess', {
                    transactionId: txId,
                })
            } catch (error) {
                showToast(
                    {
                        title: 'Error sending transaction',
                        body: `${error}`,
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                navigation.goBack()
            }
        }

        execute()
    }, [])
}
