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
import { useCallback } from 'react'
import {
    PWButton,
    PWFlatList,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { InfoButton } from '@components/InfoButton'
import { OfflineTolerantView } from '@components/OfflineTolerantView'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { ChainLabel } from '@modules/chain-ui/icon'
import { AssetTransferRequestItem } from '@modules/transactions/components/claim-assets/AssetTransferRequestItem'
import { InboxAssetRow } from '@modules/transactions/components/claim-assets/InboxAssetRow'
import { useStyles } from './styles'
import {
    useAssetTransferRequestsScreen,
    type InboxRequestRow,
} from './useAssetTransferRequestsScreen'

const keyOf = (row: InboxRequestRow): string => row.key
const typeOf = (row: InboxRequestRow): string => row.kind

export const AssetTransferRequestsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        rows,
        isPending,
        isIntegrityBlocked,
        canRejectAll,
        selectedKeys,
        isAllSelected,
        handleRowPress,
        handleRowLongPress,
        handleToggleSelectAll,
        handleCancelSelection,
        handleRejectAll,
        handleResolveSelected,
    } = useAssetTransferRequestsScreen()
    const selectedCount = selectedKeys?.size ?? 0

    useNavigationHeader({
        right: (
            <InfoButton
                title={t('asset_inbox.requests.info_title')}
                size='md'
                variant='primary'
            >
                <PWText>{t('asset_inbox.requests.info_body')}</PWText>
            </InfoButton>
        ),
    })

    const selectionHeader = selectedKeys ? (
        <PWView style={styles.selectionHeader}>
            <PWButton
                variant='linkNeutral'
                paddingStyle='dense'
                title={t('common.cancel.label')}
                onPress={handleCancelSelection}
                testID='asset_inbox_cancel_selection'
            />
            <PWText variant='bodySemibold'>
                {t('asset_inbox.requests.selected_count', {
                    count: selectedCount,
                })}
            </PWText>
            <PWButton
                variant='link'
                paddingStyle='dense'
                title={
                    isAllSelected
                        ? t('asset_inbox.requests.deselect_all')
                        : t('asset_inbox.requests.select_all')
                }
                onPress={handleToggleSelectAll}
                testID='asset_inbox_select_all'
            />
        </PWView>
    ) : null
    const rejectAllButton = canRejectAll ? (
        <PWButton
            variant='secondary'
            paddingStyle='dense'
            title={t('asset_inbox.requests.reject_all')}
            onPress={handleRejectAll}
            style={styles.rejectAll}
            testID='asset_inbox_reject_all'
        />
    ) : null
    const listHeader = selectionHeader ?? rejectAllButton

    const renderItem = useCallback(
        ({ item: row }: { item: InboxRequestRow }) => {
            switch (row.kind) {
                case 'header': {
                    return (
                        <ChainLabel
                            chainId={row.chainId}
                            style={styles.sectionHeader}
                        />
                    )
                }
                case 'claim': {
                    return (
                        <AssetTransferRequestItem
                            item={row.request}
                            scope={row.scope}
                            isSelected={selectedKeys?.has(row.key)}
                            onPress={() => handleRowPress(row)}
                            onLongPress={() => handleRowLongPress(row)}
                        />
                    )
                }
                case 'token': {
                    return (
                        <InboxAssetRow
                            asset={row.asset}
                            scope={row.scope}
                            amount={row.amount}
                            usdPrice={row.usdPrice}
                            isSelected={selectedKeys?.has(row.key)}
                            onPress={() => handleRowPress(row)}
                            onLongPress={() => handleRowLongPress(row)}
                        />
                    )
                }
            }
        },
        [
            handleRowPress,
            handleRowLongPress,
            selectedKeys,
            styles.sectionHeader,
        ],
    )

    return (
        <PWScreen
            scroll='never'
            horizontalPadding='none'
            footer={
                selectedKeys ? (
                    <PWView style={styles.selectionFooter}>
                        <PWButton
                            variant='secondary'
                            title={t('asset_inbox.requests.reject_selected', {
                                count: selectedCount,
                            })}
                            onPress={() => handleResolveSelected('reject')}
                            isDisabled={selectedCount === 0}
                            style={styles.selectionAction}
                            testID='asset_inbox_reject_selected'
                        />
                        <PWButton
                            variant='primary'
                            title={t('asset_inbox.requests.claim_selected', {
                                count: selectedCount,
                            })}
                            onPress={() => handleResolveSelected('claim')}
                            isDisabled={selectedCount === 0}
                            style={styles.selectionAction}
                            testID='asset_inbox_claim_selected'
                        />
                    </PWView>
                ) : undefined
            }
        >
            <PWFlatList
                data={rows}
                renderItem={renderItem}
                keyExtractor={keyOf}
                getItemType={typeOf}
                contentContainerStyle={styles.contentContainer}
                extraData={selectedKeys}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={
                    <OfflineTolerantView
                        isOffline={false}
                        isIntegrityBlocked={isIntegrityBlocked}
                    >
                        <EmptyView
                            isLoading={isPending}
                            loadingStyle={styles.loadingView}
                            style={styles.emptyView}
                            icon='inbox'
                            title={t('asset_inbox.requests.empty_title')}
                            body={t('asset_inbox.requests.empty_body')}
                        />
                    </OfflineTolerantView>
                }
            />
        </PWScreen>
    )
}
