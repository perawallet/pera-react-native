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

import { PWText, PWView } from '@components/core'
import { AddressSearchView } from '@components/AddressSearchView'
import { useCallback, useMemo } from 'react'
import { useSendFunds } from '@modules/transactions/hooks'
import { useStyles } from './styles'
import { AssetIcon } from '@modules/assets/components/AssetIcon'
import { EmptyView } from '@components/EmptyView'
import { ALGO_ASSET_ID, useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    canSignWithAccount,
    useAccountBalancesQuery,
    useAccountsStore,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useNavigationHeader } from '@hooks/useNavigationHeader'

export const SelectDestinationScreen = () => {
    const { selectedAsset, setDestination, setSendMode } = useSendFunds()
    const selectedAccount = useSelectedAccount()
    const accounts = useAccountsStore(state => state.accounts)
    const { accountBalances } = useAccountBalancesQuery(accounts)
    const styles = useStyles()
    const { data: assets } = useAssetsQuery()
    const asset = useMemo(() => {
        if (!selectedAsset?.assetId) return null
        return assets.get(selectedAsset?.assetId)
    }, [selectedAsset, assets])
    const { t } = useLanguage()
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
                localAccount && canSignWithAccount(localAccount)

            if (isLocalSignable) {
                // Express send: local account, we handle opt-in + transfer
                setSendMode('express')
                navigation.navigate('ExpressSend')
            } else {
                // ARC59: external account or local but can't sign (watch/hardware)
                setSendMode('arc59')
                navigation.navigate('ARC59SendSummary')
            }
        },
        [selectedAsset, accounts, accountBalances, setSendMode, setDestination, navigation],
    )

    useNavigationHeader({
        title: asset ? (
            <PWView style={styles.assetTitleContainer}>
                <AssetIcon
                    asset={asset}
                    size='md'
                />
                <PWText>{asset.name}</PWText>
            </PWView>
        ) : undefined,
    })

    if (!selectedAsset || !asset) {
        return (
            <EmptyView
                title={t('send_funds.destination.error_title')}
                body={t('send_funds.destination.error_body')}
            />
        )
    }

    return (
        <PWView style={styles.container}>
            <AddressSearchView
                onSelected={handleSelected}
                excludeAddress={selectedAccount?.address}
            />
        </PWView>
    )
}
