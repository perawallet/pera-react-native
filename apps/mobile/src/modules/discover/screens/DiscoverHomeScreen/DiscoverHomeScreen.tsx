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
    PWFlatList,
    PWRefreshControl,
    PWScreen,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { FilterSelection } from '@components/FilterSelection'
import { SearchInputTrigger } from '@components/SearchInputTrigger'
import { useLanguage } from '@hooks/useLanguage'
import { AssetRowSkeleton } from '@modules/assets'
import { DappRow } from '../../components/DappRow'
import { DiscoverSectionHeader } from '../../components/DiscoverSectionHeader'
import { NewsCard } from '../../components/NewsCard'
import { dappHostOf } from '../../utils/normalizeDappUrl'
import { useStyles } from './styles'
import {
    useDiscoverHomeScreen,
    type DiscoverNewsCardItem,
} from './useDiscoverHomeScreen'

const LOADING_ROW_COUNT = 4

export const DiscoverHomeScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const home = useDiscoverHomeScreen()
    const { topDapps, news } = home

    const renderTopDapps = () => {
        if (topDapps.isLoading) {
            return (
                <PWView testID='discover_home_dapps_loading'>
                    <AssetRowSkeleton count={LOADING_ROW_COUNT} />
                </PWView>
            )
        }
        if (topDapps.isError) {
            return (
                <EmptyView
                    body={t('discover.home.dapps_error')}
                    style={styles.emptyDapps}
                    testID='discover_home_dapps_error'
                    button={
                        <PWButton
                            variant='secondary'
                            title={t('common.retry.label')}
                            onPress={() => void topDapps.refetch()}
                            testID='discover_home_dapps_retry'
                        />
                    }
                />
            )
        }
        if (topDapps.dapps.length === 0) {
            return (
                <EmptyView
                    body={t('discover.home.dapps_empty', {
                        chain: home.selectedChainName,
                    })}
                    style={styles.emptyDapps}
                    testID='discover_home_dapps_empty'
                />
            )
        }
        return topDapps.dapps.map(dapp => (
            <DappRow
                key={dapp.url}
                dapp={dapp}
                subtitle={dapp.categories[0] ?? dappHostOf(dapp.url)}
                isFavorite={home.isFavorite(dapp.url)}
                isVerified={home.isVerified(dapp.url)}
                showChains={false}
                onPress={() => home.openDapp(dapp)}
                onToggleFavorite={() => home.toggleFavorite(dapp)}
                testID={`discover_home_dapp_${dapp.url}`}
            />
        ))
    }

    const renderNewsCard = ({ item }: { item: DiscoverNewsCardItem }) => (
        <PWView style={styles.newsCard}>
            <NewsCard
                title={item.title}
                banner={item.banner}
                dateDisplay={item.dateDisplay}
                onPress={() => home.openNewsItem(item)}
                testID={`discover_home_news_${item.id}`}
            />
        </PWView>
    )

    return (
        <PWScreen
            scroll='never'
            testID='discover_home_screen'
        >
            <PWScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <PWRefreshControl
                        isRefreshing={home.isRefreshing}
                        onRefresh={() => {
                            void home.refresh()
                        }}
                    />
                }
            >
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('discover.home.title')}
                </PWText>
                <SearchInputTrigger
                    placeholder={t('discover.search.placeholder')}
                    onPress={home.openSearch}
                    testID='discover_home_search'
                />

                <PWView style={styles.section}>
                    <DiscoverSectionHeader
                        title={t('discover.home.top_dapps')}
                        testID='discover_home_top_dapps_header'
                    />
                    {home.chainOptions.length > 0 ? (
                        <FilterSelection
                            options={home.chainOptions}
                            selectedValue={home.selectedChainId}
                            onSelect={home.selectChain}
                            contentContainerStyle={styles.chips}
                            testID='discover_home_chain_filter'
                        />
                    ) : null}
                    {renderTopDapps()}
                </PWView>

                {news.items.length > 0 ? (
                    <PWView style={styles.section}>
                        <DiscoverSectionHeader
                            title={t('discover.home.news')}
                            onPress={home.openNewsList}
                            testID='discover_home_news_header'
                        />
                        <PWFlatList
                            horizontal
                            data={news.items}
                            keyExtractor={item => item.id}
                            renderItem={renderNewsCard}
                        />
                    </PWView>
                ) : null}
            </PWScrollView>
        </PWScreen>
    )
}
