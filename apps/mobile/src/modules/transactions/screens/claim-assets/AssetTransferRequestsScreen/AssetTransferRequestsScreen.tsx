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

import { useCallback } from 'react'
import { useTheme } from '@rneui/themed'
import type { Arc59AssetRequest } from '@perawallet/wallet-core-blockchain'
import { PWDivider, PWFlatList, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { LoadingView } from '@components/LoadingView'
import { useLanguage } from '@hooks/useLanguage'
import { AssetTransferRequestItem } from '@modules/transactions/components/claim-assets/AssetTransferRequestItem'
import { useStyles } from './styles'
import { useAssetTransferRequestsScreen } from './useAssetTransferRequestsScreen'

export const AssetTransferRequestsScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { assetRequests, isPending, handleItemPress } =
        useAssetTransferRequestsScreen()

    const renderItem = useCallback(
        ({ item, index }: { item: Arc59AssetRequest; index: number }) => (
            <AssetTransferRequestItem
                item={item}
                onPress={() => handleItemPress(index)}
            />
        ),
        [handleItemPress],
    )

    const renderSeparator = useCallback(() => <PWDivider />, [])

    const renderEmptyComponent = useCallback(() => {
        if (isPending) {
            return (
                <LoadingView
                    variant='skeleton'
                    size='sm'
                    count={5}
                    style={styles.loadingContainer}
                />
            )
        }
        return (
            <EmptyView
                style={styles.emptyView}
                icon='inbox'
                title={t('messages.inbox.empty_title')}
                body={t('messages.inbox.empty_body')}
            />
        )
    }, [isPending, styles.emptyView, styles.loadingContainer, t])

    const keyExtractor = useCallback(
        (item: Arc59AssetRequest) => String(item.asset.assetId),
        [],
    )

    return (
        <PWFlatList
            data={assetRequests}
            renderItem={renderItem}
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            keyExtractor={keyExtractor}
            ItemSeparatorComponent={renderSeparator}
            ListEmptyComponent={renderEmptyComponent}
            estimatedItemSize={theme.spacing.xxl}
        />
    )
}
