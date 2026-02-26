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

import { useSendFunds } from '@modules/transactions/hooks'
import { SendFundsStackParamList } from '@modules/transactions/routes/send-funds'
import {
    canSignWithAccount,
    useAccountBalancesQuery,
    useAllAccounts,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID, useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useCallback, useMemo } from 'react'

export const useSelectDestinationScreen = () => {
    const { selectedAsset, setDestination, setSendMode } = useSendFunds()
    const selectedAccount = useSelectedAccount()
    const accounts = useAllAccounts()
    const { accountBalances } = useAccountBalancesQuery(accounts)
    const { data: assets } = useAssetsQuery(selectedAsset ? [selectedAsset.assetId] : [])

    const asset = useMemo(() => {
        if (!selectedAsset?.assetId) return null
        return assets.get(selectedAsset?.assetId)
    }, [selectedAsset, assets])

    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()

    const handleSelected = useCallback(
        (address: string) => {
            setDestination(address)

            // ALGO sends always go through normal flow
            if (
                !selectedAsset?.assetId ||
                selectedAsset.assetId === ALGO_ASSET_ID
            ) {
                setSendMode('normal')
                navigation.navigate('ConfirmTransaction')
                return
            }

            // Check if receiver already holds the asset (opted in)
            const receiverBalances = accountBalances.get(address)
            const isReceiverOptedIn = receiverBalances?.assetBalances.some(
                b => b.assetId === selectedAsset.assetId,
            )

            if (isReceiverOptedIn) {
                // Receiver already opted in — normal transfer
                setSendMode('normal')
                navigation.navigate('ConfirmTransaction')
                return
            }

            // Check if receiver is a local account we can sign for
            const localAccount = accounts.find(a => a.address === address)
            const isLocalSignable =
                localAccount && canSignWithAccount(localAccount, accounts)

            if (isLocalSignable) {
                // Express send: local account, we handle opt-in + transfer
                setSendMode('express')
                navigation.navigate('ExpressSend')
            } else {
                // ARC59: external account or local but can't sign (watch/hardware)
                setSendMode('sendArc59')
                navigation.navigate('ARC59SendSummary')
            }
        },
        [
            selectedAsset,
            accounts,
            accountBalances,
            setSendMode,
            setDestination,
            navigation,
        ],
    )

    return {
        asset,
        selectedAsset,
        selectedAccount,
        handleSelected,
    }
}
