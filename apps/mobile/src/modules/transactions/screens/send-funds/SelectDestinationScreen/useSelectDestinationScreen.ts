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
    canSignWith,
    useAccountBalancesQuery,
    useAllAccounts,
    useOnChainAccountInformationQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID, useAssetsQuery } from '@perawallet/wallet-core-assets'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useCallback, useEffect, useMemo, useState } from 'react'

export const useSelectDestinationScreen = () => {
    const { selectedAssetId, setDestination, setSendMode } = useSendFunds()
    const selectedAccount = useSelectedAccount()
    const accounts = useAllAccounts()
    const { accountBalances } = useAccountBalancesQuery(accounts)
    const [pendingExternalAddress, setPendingExternalAddress] = useState<
        string | null
    >(null)

    const assetIDs = useMemo(
        () => (selectedAssetId ? [selectedAssetId] : []),
        [selectedAssetId],
    )
    const { data: assets } = useAssetsQuery(assetIDs)
    const selectedAsset = useMemo(() => {
        if (!selectedAssetId) return undefined
        return assets.get(selectedAssetId)
    }, [selectedAssetId, assets])

    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()

    const {
        data: externalAccountInfo,
        isFetching: isCheckingExternalOptIn,
        isSuccess: isExternalQuerySuccess,
        isError: isExternalQueryError,
    } = useOnChainAccountInformationQuery(pendingExternalAddress ?? '')

    useEffect(() => {
        if (!pendingExternalAddress || !selectedAsset) return

        if (!isExternalQuerySuccess && !isExternalQueryError) return

        const isReceiverOptedIn = externalAccountInfo?.assets.some(
            a => a.assetId === BigInt(selectedAsset.assetId),
        )

        if (isReceiverOptedIn) {
            setSendMode('normal')
            navigation.navigate('ConfirmTransaction')
        } else {
            setSendMode('sendArc59')
            navigation.navigate('ARC59SendSummary')
        }

        setPendingExternalAddress(null)
    }, [
        pendingExternalAddress,
        externalAccountInfo,
        isExternalQuerySuccess,
        isExternalQueryError,
        selectedAsset,
        setSendMode,
        navigation,
    ])

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
            const receiver = accounts.find(a => a.address === address)
            const isLocalSignable =
                !!receiver && canSignWith(receiver, accounts)

            if (isLocalSignable) {
                // Express send: local account, we handle opt-in + transfer
                setSendMode('express')
                navigation.navigate('ExpressSend')
                return
            }

            // Known local account we can't sign for (watch/hardware): there's
            // no on-chain opt-in we can perform on its behalf — route to ARC59.
            if (receiver) {
                setSendMode('sendArc59')
                navigation.navigate('ARC59SendSummary')
                return
            }

            // Truly external address: check on-chain opt-in status before
            // deciding between a normal transfer and ARC59.
            setPendingExternalAddress(address)
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
        selectedAsset,
        selectedAccount,
        handleSelected,
        isCheckingExternalOptIn,
    }
}
