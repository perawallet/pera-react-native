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

import { Fragment } from 'react'
import { useWindowDimensions } from 'react-native'
import NewsIcon from '@assets/icons/discover/news.svg'
import TopDappsIcon from '@assets/icons/discover/top-dapps.svg'
import {
    PWButton,
    PWFlatList,
    PWRefreshControl,
    PWScreen,
    PWScrollView,
    PWSkeleton,
    PWText,
    PWView,
} from '@components/core'
import { DiscoverEvent } from '@analytics'
import { EmptyView } from '@components/EmptyView'
import { FilterSelection } from '@components/FilterSelection'
import { SearchInputTrigger } from '@components/SearchInputTrigger'
import { useLanguage } from '@hooks/useLanguage'
import { DappRow } from '../../components/DappRow'
import { DiscoverSectionHeader } from '../../components/DiscoverSectionHeader'
import { FavoritesSection } from '../../components/FavoritesSection'
import { LegacyFavoritesImporter } from '../../components/LegacyFavoritesImporter'
import { RowDivider } from '../../components/RowDivider'
import { NewsCard } from '../../components/NewsCard'
import { TOP_DAPPS_COUNT } from '../../utils/discoverLayout'
import { dappSubtitle } from '../../utils/dappSubtitle'
import { useAccountDrawerPickerKind } from '@modules/accounts'
import { AccountHeaderToolbar } from '@modules/accounts/shell'
import { useStyles } from './styles'
import {
    useDiscoverHomeScreen,
    type DiscoverNewsCardItem,
} from './useDiscoverHomeScreen'

// Discover's header taps stay out of the Home tab's metrics.
const DISCOVER_HEADER_EVENTS = {
    qrScan: DiscoverEvent.QrScan,
    pasteLink: DiscoverEvent.PasteLink,
} as const

export const DiscoverHomeScreen = () => {
    const { fontScale } = useWindowDimensions()
    const styles = useStyles(fontScale)
    const { t } = useLanguage()
    const home = useDiscoverHomeScreen()
    // The header's account picker opens the portfolio drawer, as on Home.
    useAccountDrawerPickerKind('portfolio')
    const { topDapps, news } = home

    const renderTopDapps = () => {
        if (topDapps.isLoading) {
            return (
                <PWView testID='discover_home_dapps_loading'>
                    {Array.from({ length: TOP_DAPPS_COUNT }, (_, index) => (
                        <Fragment key={index}>
                            {index > 0 ? <RowDivider /> : null}
                            <PWView style={styles.dappLoadingRow}>
                                <PWSkeleton style={styles.dappLoadingLogo} />
                                <PWSkeleton style={styles.dappLoadingName} />
                            </PWView>
                        </Fragment>
                    ))}
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
                    body={t('discover.home.dapps_empty_open_url', {
                        chain: home.selectedChainName,
                    })}
                    shouldTruncateBody={false}
                    style={styles.emptyDapps}
                    testID='discover_home_dapps_empty'
                />
            )
        }
        return (
            <PWView>
                {topDapps.dapps.map((dapp, index) => (
                    <Fragment key={dapp.url}>
                        {index > 0 ? <RowDivider /> : null}
                        <DappRow
                            dapp={dapp}
                            subtitle={dappSubtitle(dapp)}
                            isFavorite={home.isFavorite(dapp.url)}
                            isVerified={home.isVerified(dapp.url)}
                            showChains={false}
                            onPress={() => home.openDapp(dapp)}
                            onToggleFavorite={() => home.toggleFavorite(dapp)}
                            testID={`discover_home_dapp_${dapp.url}`}
                        />
                    </Fragment>
                ))}
            </PWView>
        )
    }

    const renderNewsCard = ({ item }: { item: DiscoverNewsCardItem }) => (
        <PWView style={styles.newsCard}>
            <NewsCard
                title={item.title}
                banner={item.banner}
                dateDisplay={item.dateDisplay}
                variant='plain'
                onPress={() => home.openNewsItem(item)}
                testID={`discover_home_news_${item.id}`}
            />
        </PWView>
    )

    return (
        <PWScreen
            scroll='never'
            // The header runs edge to edge like Home's; the content pads itself.
            horizontalPadding='none'
            testID='discover_home_screen'
        >
            <AccountHeaderToolbar
                testIDPrefix='discover_home'
                events={DISCOVER_HEADER_EVENTS}
            />
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
                <PWText variant='h1'>{t('discover.home.title')}</PWText>
                <SearchInputTrigger
                    placeholder={t('discover.search.placeholder')}
                    onPress={home.openSearch}
                    testID='discover_home_search'
                />

                <FavoritesSection />

                <PWView style={styles.section}>
                    <DiscoverSectionHeader
                        title={t('discover.home.explore_dapps')}
                        icon={<TopDappsIcon />}
                        testID='discover_home_top_dapps_header'
                    />
                    {home.chainOptions.length > 0 ? (
                        // Runs to the screen's edges, so a chip is only cut where the screen ends.
                        <PWView style={styles.bleed}>
                            <FilterSelection
                                options={home.chainOptions}
                                selectedValue={home.selectedChainId}
                                onSelect={home.selectChain}
                                emphasizeSelection
                                showsHorizontalScrollIndicator
                                contentContainerStyle={styles.bleedContent}
                                testID='discover_home_chain_filter'
                            />
                        </PWView>
                    ) : null}
                    <PWView style={styles.dappPreview}>
                        {renderTopDapps()}
                    </PWView>
                    {home.selectedChainId && (
                        <PWButton
                            variant='secondary'
                            title={
                                !topDapps.isLoading && !topDapps.isError
                                    ? t('discover.home.see_chain_dapps_count', {
                                          count: topDapps.count,
                                          chain: home.selectedChainName,
                                      })
                                    : t('discover.home.see_chain_dapps', {
                                          chain: home.selectedChainName,
                                      })
                            }
                            onPress={home.openDappDirectory}
                            testID='discover_home_top_dapps_directory'
                        />
                    )}
                </PWView>

                {news.items.length > 0 ? (
                    <PWView style={styles.section}>
                        <DiscoverSectionHeader
                            title={t('discover.home.news')}
                            icon={<NewsIcon />}
                            onPress={home.openNewsList}
                            testID='discover_home_news_header'
                        />
                        <PWFlatList
                            horizontal
                            data={news.items}
                            keyExtractor={item => item.id}
                            renderItem={renderNewsCard}
                            style={styles.bleed}
                            contentContainerStyle={styles.newsContent}
                        />
                    </PWView>
                ) : null}
            </PWScrollView>
            {/* One-time, hidden: copies the legacy WebView Discover's favorites. */}
            <LegacyFavoritesImporter />
        </PWScreen>
    )
}
