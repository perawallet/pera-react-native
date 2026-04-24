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

import { useEffect, useMemo } from 'react'
import { BackHandler } from 'react-native'

import { bottomSheetNotifier } from '@components/core'
import { useToast } from '@hooks/useToast'
import { useSendFunds } from '@modules/transactions/hooks'
import {
    useAccountBalancesInvalidator,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    SendTransactionParams,
    useTransactionSendFlow,
} from '@perawallet/wallet-core-transactions'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useAlgodErrorMessage } from '@hooks/useAlgodErrorMessage'
import { logger } from '@perawallet/wallet-core-shared'

export const useTransactionProcessingScreen = () => {
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const {
        selectedAssetId,
        amount,
        destination,
        note,
        sendMode,
        arc59Summary,
        isCloseAccount,
    } = useSendFunds()

    const assetIDs = useMemo(
        () => (selectedAssetId ? [selectedAssetId] : []),
        [selectedAssetId],
    )
    const { data: assets } = useAssetsQuery(assetIDs)
    const selectedAsset = useMemo(() => {
        if (!selectedAssetId) return undefined
        return assets.get(selectedAssetId)
    }, [selectedAssetId, assets])
    const selectedAccount = useSelectedAccount()
    const { showToast } = useToast()
    const { getMessage } = useAlgodErrorMessage()
    const { invalidate: invalidateAccountBalances } =
        useAccountBalancesInvalidator()

    const { execute } = useTransactionSendFlow()

    useEffect(() => {
        const subscription = BackHandler.addEventListener(
            'hardwareBackPress',
            () => true,
        )

        const sendParams = {
            sendMode,
            sender: selectedAccount,
            receiver: destination,
            asset: selectedAsset,
            amount,
            note,
            isCloseAccount,
            arc59Summary,
        } as SendTransactionParams

        execute({
            params: sendParams,
        })
            .then(txId => {
                invalidateAccountBalances()
                navigation.replace('TransactionSuccess', {
                    transactionId: txId,
                })
            })
            .catch(error => {
                logger.error('Transaction failed', { error })
                const { title, body } = getMessage(error)
                showToast(
                    {
                        title,
                        body,
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
