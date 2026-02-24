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
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { bottomSheetNotifier } from '@components/core'
import { useToast } from '@hooks/useToast'
import { useClaimAssets } from '@modules/transactions/hooks'
import { useArc59ClaimTransaction } from '@perawallet/wallet-core-blockchain'
import { useTransactionSigner } from '@perawallet/wallet-core-signing'
import type { MessagesStackParamList } from '@modules/messages/routes/types'
import { useLanguage } from '@hooks/useLanguage'
import { logger } from '@perawallet/wallet-core-shared'

export const useClaimProcessingScreen = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<MessagesStackParamList>>()
    const route =
        useRoute<RouteProp<MessagesStackParamList, 'ClaimProcessing'>>()
    const { mode, assetIndex, shouldClaimAlgo } = route.params
    const { assetRequests, accountAddress } = useClaimAssets()
    const { signTransactions } = useTransactionSigner()
    const { claimAsset, rejectAsset } =
        useArc59ClaimTransaction(signTransactions)
    const { showToast } = useToast()
    const hasExecuted = useRef(false)
    const { t } = useLanguage()

    const asset = assetRequests[assetIndex]

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
            if (!accountAddress || !asset) {
                logger.error(
                    'No valid account or asset request found for claim processing',
                )
                showToast(
                    {
                        title: t('errors.transaction.title'),
                        body: t('errors.transaction.body'),
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

                if (mode === 'claim') {
                    const result = await claimAsset({
                        sender: accountAddress,
                        assetId: BigInt(asset.asset.assetId),
                        shouldClaimAlgo,
                    })
                    txId = result.txIds[result.txIds.length - 1]
                } else {
                    const result = await rejectAsset({
                        sender: accountAddress,
                        assetId: BigInt(asset.asset.assetId),
                        shouldClaimAlgo,
                    })
                    txId = result.txIds[result.txIds.length - 1]
                }

                navigation.replace('ClaimSuccess', {
                    transactionId: txId,
                    variant: mode,
                })
            } catch (error) {
                logger.error('Error processing claim asset transaction', {
                    error,
                })
                showToast(
                    {
                        title: t('errors.transaction.title'),
                        body: t('errors.transaction.body'),
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
