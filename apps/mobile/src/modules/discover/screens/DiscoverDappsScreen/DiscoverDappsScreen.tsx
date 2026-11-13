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

import {
    PWButton,
    PWDropdown,
    PWFlatList,
    PWIcon,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { FilterSelection } from '@components/FilterSelection'
import { SearchInputTrigger } from '@components/SearchInputTrigger'
import { useLanguage } from '@hooks/useLanguage'
import { AssetRowSkeleton } from '@modules/assets'
import { DappRow } from '../../components/DappRow'
import type { DirectoryDapp } from '../../utils/dappDirectory'
import { dappHostOf } from '../../utils/normalizeDappUrl'
import { useDiscoverDappsScreen } from './useDiscoverDappsScreen'
import { useStyles } from './styles'

const LOADING_ROW_COUNT = 6

export const DiscoverDappsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const screen = useDiscoverDappsScreen()

    const renderRow = ({ item }: { item: DirectoryDapp }) => (
        <DappRow
            dapp={item.dapp}
            subtitle={
                item.dapp.categories.join(', ') || dappHostOf(item.dapp.url)
            }
            isFavorite={screen.isFavorite(item.dapp.url)}
            isVerified={screen.isVerified(item.dapp.url)}
            showChains={screen.showChains}
            onPress={() => screen.openDapp(item.dapp)}
            onToggleFavorite={() => screen.toggleFavorite(item.dapp)}
            testID={`discover_dapps_row_${item.dapp.url}`}
        />
    )

    const renderEmpty = () => {
        if (screen.isLoading) {
            return (
                <PWView testID='discover_dapps_loading'>
                    <AssetRowSkeleton count={LOADING_ROW_COUNT} />
                </PWView>
            )
        }
        if (screen.isError) {
            return (
                <EmptyView
                    body={t('discover.dapps.load_failure')}
                    style={styles.empty}
                    testID='discover_dapps_error'
                    button={
                        <PWButton
                            variant='secondary'
                            title={t('common.retry.label')}
                            onPress={screen.retry}
                            testID='discover_dapps_retry'
                        />
                    }
                />
            )
        }
        return (
            <EmptyView
                body={
                    screen.selectedChainId === null
                        ? t('discover.search.no_results')
                        : t('discover.home.dapps_empty', {
                              chain: screen.selectedChainName,
                          })
                }
                style={styles.empty}
                testID='discover_dapps_empty'
            />
        )
    }

    const header = (
        <PWView style={styles.header}>
            <SearchInputTrigger
                placeholder={t('discover.search.placeholder')}
                onPress={screen.openSearch}
                testID='discover_dapps_search'
            />
            {screen.chainOptions.length > 0 ? (
                // Wrapped so the horizontal ScrollView keeps its content height.
                <PWView>
                    <FilterSelection
                        options={screen.chainOptions}
                        selectedValue={screen.selectedChainId}
                        onSelect={screen.selectChain}
                        contentContainerStyle={styles.chips}
                        testID='discover_dapps_chain_filter'
                    />
                </PWView>
            ) : null}
            <PWView style={styles.listHeader}>
                <PWText variant='h4'>{t('discover.dapps.list_title')}</PWText>
                <PWDropdown
                    align='right'
                    items={screen.sortOptions.map(option => ({
                        label: option.label,
                        onPress: () => screen.selectSort(option.id),
                        isSelected: option.id === screen.sort,
                    }))}
                >
                    <PWView
                        style={styles.sortTrigger}
                        testID='discover_dapps_sort'
                    >
                        <PWText style={styles.sortLabel}>
                            {screen.sortLabel}
                        </PWText>
                        <PWIcon
                            name='chevron-down'
                            size='sm'
                            variant='link'
                        />
                    </PWView>
                </PWDropdown>
            </PWView>
            {screen.items.length > 0 ? (
                <PWView>
                    <FilterSelection
                        options={screen.categoryOptions}
                        selectedValue={screen.selectedCategory}
                        onSelect={screen.selectCategory}
                        contentContainerStyle={styles.chips}
                        testID='discover_dapps_category_filter'
                    />
                </PWView>
            ) : null}
        </PWView>
    )

    const footer = (
        <PWView
            style={styles.apply}
            testID='discover_dapps_apply'
        >
            <PWText style={styles.applyPrompt}>
                {t('discover.dapps.apply_prompt')}
            </PWText>
            <PWButton
                variant='primary'
                title={t('discover.dapps.apply_cta')}
                onPress={screen.applyForDiscover}
                testID='discover_dapps_apply_button'
            />
        </PWView>
    )

    return (
        <PWScreen
            scroll='never'
            testID='discover_dapps_screen'
        >
            <PWFlatList
                data={screen.items}
                renderItem={renderRow}
                keyExtractor={item => item.dapp.url}
                ListHeaderComponent={header}
                ListEmptyComponent={renderEmpty()}
                ListFooterComponent={footer}
            />
        </PWScreen>
    )
}
