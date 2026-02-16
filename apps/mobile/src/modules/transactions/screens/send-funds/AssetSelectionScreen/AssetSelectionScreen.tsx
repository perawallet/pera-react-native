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

import { PWFlatList, PWTouchableOpacity } from '@components/core'
import {
    AssetWithAccountBalance,
    useAccountBalancesQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useCallback, useMemo } from 'react'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { SendFundsStackParamList } from '../../../routes/send-funds/types'
import { useStyles } from './styles'
import { useSendFunds } from '@modules/transactions/hooks'
import { LoadingView } from '@components/LoadingView'

export const AssetSelectionScreen = () => {
    const styles = useStyles()
    const selectedAccount = useSelectedAccount()
    const { setSelectedAsset } = useSendFunds()
    const navigation =
        useNavigation<StackNavigationProp<SendFundsStackParamList>>()
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )

    const handleSelected = useCallback(
        (item: AssetWithAccountBalance) => {
            setSelectedAsset(item)
            navigation.navigate('InputAmount')
        },
        [navigation, setSelectedAsset],
    )

    const balanceData = useMemo(
        () =>
            selectedAccount?.address
                ? accountBalances.get(selectedAccount.address)?.assetBalances
                : [],
        [accountBalances, selectedAccount?.address],
    )
    const renderItem = useCallback(
        ({ item }: { item: AssetWithAccountBalance }) => {
            return (
                <PWTouchableOpacity
                    onPress={() => handleSelected(item)}
                    key={`asset-${item.assetId}`}
                    style={styles.item}
                >
                    <AccountAssetItemView accountBalance={item} />
                </PWTouchableOpacity>
            )
        },
        [handleSelected, styles],
    )

    return (
        <PWFlatList
            contentContainerStyle={styles.container}
            data={balanceData ?? []}
            renderItem={renderItem}
            keyExtractor={item => item.assetId}
            ListEmptyComponent={
                <LoadingView
                    variant='skeleton'
                    count={3}
                />
            }
        />
    )
}
