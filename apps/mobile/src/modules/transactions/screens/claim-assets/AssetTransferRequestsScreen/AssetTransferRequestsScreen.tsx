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
import type { Arc59AssetRequest } from '@perawallet/wallet-core-asa-inbox'
import { PWDivider, PWFlatList, PWText } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { AssetTransferRequestItem } from '@modules/transactions/components/claim-assets/AssetTransferRequestItem'
import { useStyles } from './styles'
import { useAssetTransferRequestsScreen } from './useAssetTransferRequestsScreen'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { InfoButton } from '@components/InfoButton'

export const AssetTransferRequestsScreen = () => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { assetRequests, isPending, handleItemPress } =
        useAssetTransferRequestsScreen()

    useNavigationHeader({
        right: <InfoButton
            title={t('arc59.requests.info_title')}
            size='md'
            variant='primary'
        >
            <PWText>{t('arc59.requests.info_body')}</PWText>
        </InfoButton>,
    })

    const renderItem = useCallback(
        ({ item, index }: { item: Arc59AssetRequest; index: number }) => (
            <AssetTransferRequestItem
                item={item}
                onPress={() => handleItemPress(index)}
            />
        ),
        [handleItemPress],
    )

    const renderSeparator = useCallback(() => <PWDivider style={styles.separator} />, [])

    const keyExtractor = useCallback(
        (item: Arc59AssetRequest, index: number) => String(item.id ?? '' + index),
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
            ListEmptyComponent={
                <EmptyView
                    isLoading={isPending}
                    loadingStyle={styles.loadingView}
                    style={styles.emptyView}
                    icon='inbox'
                    title={t('arc59.requests.empty_title')}
                    body={t('arc59.requests.empty_body')}
                />
            }
            estimatedItemSize={theme.spacing.xxl}
        />
    )
}
