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
    PWSkeleton,
    PWView,
} from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { NewsCard } from '../../components/NewsCard'
import type { DiscoverNewsCardItem } from '../DiscoverHomeScreen/useDiscoverHomeScreen'
import { useDiscoverNewsScreen } from './useDiscoverNewsScreen'
import { useStyles } from './styles'

const SKELETON_CARD_COUNT = 3
// lanekeep-ignore-next-line pera/no-numeric-sizes reason: card placeholder height, about a banner plus its title
const SKELETON_CARD_HEIGHT = 240

export const DiscoverNewsScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const screen = useDiscoverNewsScreen()

    const renderCard = ({ item }: { item: DiscoverNewsCardItem }) => (
        <NewsCard
            title={item.title}
            banner={item.banner}
            dateDisplay={item.dateDisplay}
            showReadAction
            onPress={() => screen.openNewsItem(item)}
            testID={`discover_news_card_${item.id}`}
        />
    )

    const renderEmpty = () => {
        if (screen.isLoading) {
            return (
                <PWView
                    style={styles.skeleton}
                    testID='discover_news_loading'
                >
                    {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                        <PWSkeleton
                            key={i}
                            height={SKELETON_CARD_HEIGHT}
                        />
                    ))}
                </PWView>
            )
        }
        return (
            <EmptyView
                body={t(
                    screen.isError
                        ? 'discover.news.list_failure'
                        : 'discover.search.no_results',
                )}
                style={styles.empty}
                testID={
                    screen.isError
                        ? 'discover_news_error'
                        : 'discover_news_empty'
                }
                button={
                    screen.isError ? (
                        <PWButton
                            variant='secondary'
                            title={t('common.retry.label')}
                            onPress={screen.retry}
                            testID='discover_news_retry'
                        />
                    ) : undefined
                }
            />
        )
    }

    return (
        <PWScreen
            scroll='never'
            testID='discover_news_screen'
        >
            <PWFlatList
                data={screen.items}
                renderItem={renderCard}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={renderEmpty()}
                refreshControl={
                    <PWRefreshControl
                        isRefreshing={screen.isRefreshing}
                        onRefresh={() => {
                            void screen.refresh()
                        }}
                    />
                }
            />
        </PWScreen>
    )
}
