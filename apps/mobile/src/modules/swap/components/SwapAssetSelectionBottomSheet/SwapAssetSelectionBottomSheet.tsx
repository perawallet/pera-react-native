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

import { useCallback, useMemo } from 'react'
import {
    AssetWithAccountBalance,
    useAccountBalancesQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import {
    PWBottomSheet,
    PWFlatList,
    PWIcon,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
} from '@components/core'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { LoadingView } from '@components/LoadingView'
import { useStyles } from './styles'

export type SwapAssetSelectionBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onAssetSelected: (asset: AssetWithAccountBalance) => void
}

export const SwapAssetSelectionBottomSheet = ({
    isVisible,
    onClose,
    onAssetSelected,
}: SwapAssetSelectionBottomSheetProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const selectedAccount = useSelectedAccount()
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )

    const balanceData = useMemo(
        () =>
            selectedAccount?.address
                ? accountBalances.get(selectedAccount.address)?.assetBalances
                : [],
        [accountBalances, selectedAccount?.address],
    )

    const handleAssetSelected = useCallback(
        (asset: AssetWithAccountBalance) => {
            onAssetSelected(asset)
            onClose()
        },
        [onAssetSelected, onClose],
    )

    const renderItem = useCallback(
        ({ item }: { item: AssetWithAccountBalance }) => (
            <PWTouchableOpacity
                onPress={() => handleAssetSelected(item)}
                style={styles.item}
            >
                <AccountAssetItemView accountBalance={item} />
            </PWTouchableOpacity>
        ),
        [handleAssetSelected, styles],
    )

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            innerContainerStyle={styles.container}
        >
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        onPress={onClose}
                    />
                }
                center={
                    <PWText variant='h4'>
                        {t('swap.asset_selection.title')}
                    </PWText>
                }
            />
            <PWFlatList
                contentContainerStyle={styles.listContent}
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
        </PWBottomSheet>
    )
}
