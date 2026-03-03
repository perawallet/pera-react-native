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

import { useWebView } from '@modules/webview/hooks'
import { useSendFunds } from '@modules/transactions/hooks'
import {
    useRemoveAccountById,
    useSelectedAccount,
    useSelectedAccountAddress,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { useNetwork } from '@perawallet/wallet-extension-network'
import { useRoute, type RouteProp } from '@react-navigation/native'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { generateUniqueId } from '@perawallet/wallet-core-shared'

type UseTransactionSuccessScreenResult = {
    handleDone: () => void
    handleViewInExplorer: () => void
    isCloseAccount: boolean
}

export const useTransactionSuccessScreen =
    (): UseTransactionSuccessScreenResult => {
        const route =
            useRoute<RouteProp<SendFundsStackParamList, 'TransactionSuccess'>>()
        const { transactionId } = route.params
        const { onFinished, isCloseAccount } = useSendFunds()
        const { networkConfig } = useNetwork()
        const { pushWebView } = useWebView()
        const removeAccountById = useRemoveAccountById()
        const selectedAccount = useSelectedAccount()
        const accounts = useAccountsStore(state => state.accounts)
        const { setSelectedAccountAddress } = useSelectedAccountAddress()

        const handleDone = useCallback(() => {
            if (isCloseAccount && selectedAccount?.id) {
                removeAccountById(selectedAccount.id)
                const remaining = accounts.filter(
                    a => a.id !== selectedAccount.id,
                )
                setSelectedAccountAddress(
                    remaining.length > 0 ? remaining[0].address : null,
                )
            }
            onFinished?.()
        }, [
            onFinished,
            isCloseAccount,
            selectedAccount,
            removeAccountById,
            accounts,
            setSelectedAccountAddress,
        ])

        const handleViewInExplorer = useCallback(() => {
            pushWebView({
                url: `${networkConfig.explorerUrl}/tx/${transactionId}`,
                id: generateUniqueId(),
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
            isCloseAccount,
        }
    }
