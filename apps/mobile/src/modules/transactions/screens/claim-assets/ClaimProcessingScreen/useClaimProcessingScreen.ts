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

import { useEffect } from 'react'
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
import {
    SendClaimParams,
    useTransactionSendFlow,
} from '@perawallet/wallet-core-transactions'
import type { MessagesStackParamList } from '@modules/messages/routes/types'
import { useLanguage } from '@hooks/useLanguage'
import { config } from '@perawallet/wallet-core-config'

export const useClaimProcessingScreen = () => {
    const navigation =
        useNavigation<NativeStackNavigationProp<MessagesStackParamList>>()
    const route =
        useRoute<RouteProp<MessagesStackParamList, 'ClaimProcessing'>>()
    const { mode, assetIndex, shouldClaimAlgo } = route.params
    const { assetRequests, accountAddress } = useClaimAssets()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const { execute } = useTransactionSendFlow()

    const asset = assetRequests[assetIndex]

    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => true,
        )

        const sendParams = {
            sendMode: mode,
            sender: accountAddress,
            assetId: asset.asset.assetId,
            shouldClaimAlgo,
        } as SendClaimParams

        execute({
            params: sendParams,
        })
            .then(txId => {
                navigation.replace('ClaimSuccess', {
                    transactionId: txId,
                })
            })
            .catch(error => {
                showToast(
                    {
                        title: t('arc59.processing_error.title'),
                        body: config.debugEnabled
                            ? `${error}`
                            : t('arc59.processing_error.body'),
                        type: 'error',
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
                navigation.goBack()
            })

        return () => subscription.remove()
    }, [])
}
