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

import { Skeleton } from '@rneui/themed'
import { PWView } from '@components/PWView'
import {
    AssetWithAccountBalance,
    useAccountBalancesQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useCallback, useContext, useMemo } from 'react'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { PWTouchableOpacity } from '@components/PWTouchableOpacity'
import { useStyles } from './styles'
import { SendFundsContext } from '@modules/transactions/providers/SendFundsProvider'
import { PWHeader } from '@components/PWHeader'
import { useLanguage } from '@hooks/language'
import { FlashList } from '@shopify/flash-list'

type SendFundsAssetSelectionViewProps = {
    onSelected: () => void
    onBack: () => void
}

const LoadingView = () => {
    const styles = useStyles()
    return (
        <PWView style={styles.loadingContainer}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
        </PWView>
    )
}

export const SendFundsAssetSelectionView = ({
    onSelected,
    onBack,
}: SendFundsAssetSelectionViewProps) => {
    const styles = useStyles()
    const selectedAccount = useSelectedAccount()
    const { setSelectedAsset } = useContext(SendFundsContext)
    const { t } = useLanguage()
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )

    const handleSelected = useCallback(
        (item: AssetWithAccountBalance) => {
            setSelectedAsset(item)
            onSelected()
        },
        [onSelected, setSelectedAsset],
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
        <FlashList
            data={balanceData}
            renderItem={renderItem}
            keyExtractor={item => item.assetId}
            ListHeaderComponent={
                <PWHeader
                    leftIcon='cross'
                    onLeftPress={onBack}
                    title={t('send_funds.asset_selection.title')}
                />
            }
            ListEmptyComponent={<LoadingView />}
        />
    )
}
