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

import { PWFlatList, PWScreen, PWText, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { AssetRowSkeleton } from '@modules/assets'
import { HideTokenRow } from './HideTokenRow'
import { useStyles } from './styles'
import {
    useHideTokensScreen,
    type HideTokensListItem,
} from './useHideTokensScreen'

const SKELETON_ROWS = 8

export const HideTokensScreen = () => {
    const styles = useStyles()
    const {
        items,
        isPending,
        showsNetwork,
        isRowHidden,
        isRowLocked,
        handleToggleHidden,
        t,
    } = useHideTokensScreen()

    const renderItem = ({ item }: { item: HideTokensListItem }) =>
        item.kind === 'header' ? (
            <PWView style={styles.header}>
                <PWText variant='h4'>{item.title}</PWText>
            </PWView>
        ) : (
            <HideTokenRow
                row={item.row}
                isHidden={isRowHidden(item.row)}
                isLocked={isRowLocked(item.row)}
                showsNetwork={showsNetwork}
                onToggle={handleToggleHidden}
            />
        )

    return (
        <PWScreen
            testID='hide_tokens_screen'
            scroll='never'
        >
            <PWFlatList
                data={items}
                renderItem={renderItem}
                keyExtractor={item =>
                    item.kind === 'header'
                        ? `header-${item.id}`
                        : `${item.row.scope.chainId}/${item.row.scope.networkId}/${item.row.assetId}`
                }
                getItemType={item => item.kind}
                ListEmptyComponent={
                    isPending ? (
                        <AssetRowSkeleton count={SKELETON_ROWS} />
                    ) : (
                        <EmptyView
                            title={t('hide_tokens.empty_title')}
                            body={t('hide_tokens.empty_body')}
                        />
                    )
                }
            />
        </PWScreen>
    )
}
