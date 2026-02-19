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

import { useCallback, useEffect } from 'react'
import { BackHandler } from 'react-native'
import { v4 as uuid } from 'uuid'

import { useWebView } from '@hooks/usePeraWebviewInterface'
import { useSendFunds } from '@modules/transactions/hooks'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'

type UseTransactionSuccessScreenResult = {
    handleDone: () => void
    handleViewInExplorer: () => void
}

export const useTransactionSuccessScreen =
    (): UseTransactionSuccessScreenResult => {
        const route =
            useRoute<RouteProp<SendFundsStackParamList, 'TransactionSuccess'>>()
        const { transactionId } = route.params
        const { onFinished } = useSendFunds()
        const { networkConfig } = useNetwork()
        const { pushWebView } = useWebView()

        const handleDone = useCallback(() => {
            onFinished?.()
        }, [onFinished])

        const handleViewInExplorer = useCallback(() => {
            pushWebView({
                url: `${networkConfig.explorerUrl}/tx/${transactionId}`,
                id: uuid(),
            })
        }, [networkConfig.explorerUrl, transactionId, pushWebView])

        useEffect(() => {
            const subscription = BackHandler.addEventListener(
                'hardwareBackPress',
                () => {
                    handleDone()
                    return true
                },
            )
            return () => subscription.remove()
        }, [handleDone])

        return {
            handleDone,
            handleViewInExplorer,
        }
    }
