/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { PWButton, PWText, PWView } from '@components/core'
import React, { useCallback } from 'react'
import type { RefreshControlProps } from 'react-native'
import { useStyles } from './styles'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { findNativeAsset } from '@perawallet/wallet-core-assets'

import { EmptyView } from '@components/EmptyView'
import { FilterSelection } from '@components/FilterSelection'
import { SearchableList } from '@components/SearchableList'
import {
    AssetGroupRow,
    AssetRowSkeleton,
    groupedHoldingItemKey,
} from '@modules/assets'
import { useLanguage } from '@hooks/useLanguage'
import { SwipeableAssetItem } from './SwipeableAssetItem'
import { BackupReminderBanner } from '../BackupReminderBanner'
import { LegacyQuantumNotice } from '../LegacyQuantumNotice'
import { NetworkFundingState } from './NetworkFundingState'
import {
    useAccountAssetList,
    type AccountAssetListItem,
} from './useAccountAssetList'
import { ItemSeparator } from './ItemSeparator'

export type AccountAssetListProps = {
    account: WalletAccount
    scrollEnabled?: boolean
    header?: React.ReactNode
    isLoading?: boolean
    refreshControl?: React.ReactElement<RefreshControlProps>
}

export const AccountAssetList = ({
    account,
    scrollEnabled,
    header,
    isLoading = false,
    refreshControl,
}: AccountAssetListProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        isChainSwitchedOff,
        items,
        chainFilterOptions,
        fundingChainId,
        selectedChainId,
        setSelectedChainId,
        toggleGroupExpanded,
        convertFiat,
        isReadOnly,
        canManageAssets,
        listRef,
        headerState,
        setSearchFilter,
        handleOpenAddAsset,
        handleOpenManage,
        getEmptyTitle,
        getEmptyBody,
        renderItemProps,
    } = useAccountAssetList({ account, t })

    const renderItem = useCallback(
        ({ item }: { item: AccountAssetListItem }) => {
            if (item.kind === 'skeleton') {
                return <AssetRowSkeleton style={styles.rowItem} />
            }
            if (item.kind === 'group') {
                return (
                    <AssetGroupRow
                        item={item}
                        convertFiat={convertFiat}
                        onToggleExpanded={() =>
                            toggleGroupExpanded(item.group.id)
                        }
                        style={styles.rowItem}
                    />
                )
            }

            const { holding: row } = item
            const { chainId } = row.scope
            return (
                <SwipeableAssetItem
                    item={row}
                    chainId={chainId}
                    isNativeAsset={
                        findNativeAsset(chainId)?.assetId === row.assetId
                    }
                    isSwipeEnabled={renderItemProps.isSwipeable(row)}
                    isGroupMember={item.isGroupMember}
                    shouldShowNetwork={renderItemProps.shouldShowNetwork}
                    convertFiat={convertFiat}
                    onPress={renderItemProps.goToAssetScreen}
                    onOptOut={renderItemProps.handleOptOut}
                />
            )
        },
        [renderItemProps, convertFiat, toggleGroupExpanded, styles.rowItem],
    )

    const chainFilter =
        chainFilterOptions.length > 0 ? (
            <FilterSelection
                options={chainFilterOptions}
                selectedValue={selectedChainId}
                onSelect={setSelectedChainId}
                testID='asset_network_filter'
            />
        ) : undefined

    const listHeader = (
        <PWView style={styles.headerContainer}>
            <BackupReminderBanner
                account={account}
                isLoading={isLoading}
            />
            <LegacyQuantumNotice account={account} />
            {headerState.isOpen && (
                <>
                    {header}
                    <PWView style={styles.titleBar}>
                        <PWView style={styles.titleBarTitleContainer}>
                            <PWText
                                variant='h3'
                                truncate
                            >
                                {t('account_details.assets.title')}
                            </PWText>
                        </PWView>
                        <PWView style={styles.titleBarButtonContainer}>
                            {canManageAssets && (
                                <PWButton
                                    testID='manage_assets_button'
                                    icon='sliders'
                                    variant='helper'
                                    paddingStyle='none'
                                    onPress={handleOpenManage}
                                    style={styles.manageButton}
                                />
                            )}
                            {!isReadOnly && canManageAssets && (
                                <PWButton
                                    testID='add_asset_button'
                                    icon='plus'
                                    title={t(
                                        'account_details.assets.add_asset',
                                    )}
                                    variant='helper'
                                    paddingStyle='none'
                                    onPress={handleOpenAddAsset}
                                    style={styles.addAssetButton}
                                />
                            )}
                        </PWView>
                    </PWView>
                </>
            )}
        </PWView>
    )

    return (
        <PWView style={styles.container}>
            <SearchableList
                pauseSyncOnInteraction
                ref={listRef}
                data={items}
                renderItem={renderItem}
                getItemType={assetListItemType}
                scrollEnabled={scrollEnabled}
                refreshControl={refreshControl}
                keyExtractor={accountAssetListItemKey}
                // Same anchoring hazard as the NFT gallery: FlashList
                // v2 re-anchors on the previously-first-visible row after every
                // data change, and a re-sort moves every row, so the anchor drags
                // the viewport to wherever that row went. This list only ever
                // reorders or narrows — never prepends — so anchoring costs it.
                maintainVisibleContentPosition={{ disabled: true }}
                // Render further ahead so fast flings on a long asset list don't
                // outrun the cell renderer and leave blank gaps.
                drawDistance={2000}
                ItemSeparatorComponent={ItemSeparator}
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={styles.rootContainer}
                ListHeaderComponent={listHeader}
                ListFooterComponent={
                    fundingChainId === null ? undefined : (
                        <NetworkFundingState
                            account={account}
                            chainId={fundingChainId}
                        />
                    )
                }
                searchPlaceholder={t(
                    'account_details.assets.search_placeholder',
                )}
                onSearchChange={setSearchFilter}
                searchAccessory={chainFilter}
                ListEmptyComponent={
                    isChainSwitchedOff ? null : (
                        <EmptyView
                            title={getEmptyTitle()}
                            body={getEmptyBody()}
                        />
                    )
                }
            />
        </PWView>
    )
}

const assetListItemType = (item: AccountAssetListItem) => item.kind

const accountAssetListItemKey = (item: AccountAssetListItem): string =>
    item.kind === 'skeleton' ? item.id : groupedHoldingItemKey(item)
