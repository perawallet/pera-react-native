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

import { useCallback, useMemo } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useDiscoverNewsDetailQuery } from '@perawallet/wallet-core-discover'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { RootStackParamList } from '@routes/types'
import { useOpenDapp } from '../../hooks/useOpenDapp'
import {
    parseArticleHtml,
    toArticleLinkUrl,
    type ArticleBlock,
} from '../../utils/articleHtml'
import { formatNewsDate } from '../../utils/formatNewsDate'

export type UseDiscoverNewsDetailScreenResult = {
    title: string
    dateDisplay: string
    banner: Nullable<string>
    blocks: ArticleBlock[]
    isLoading: boolean
    isError: boolean
    retry: () => void
    openLink: (href: string) => void
}

export const useDiscoverNewsDetailScreen =
    (): UseDiscoverNewsDetailScreenResult => {
        const route =
            useRoute<RouteProp<RootStackParamList, 'DiscoverNewsDetail'>>()
        const query = useDiscoverNewsDetailQuery(route.params.newsId)
        const { openWebPage } = useOpenDapp()

        const news = query.data
        const contentHtml = news?.contentHtml
        const blocks = useMemo(
            () => (contentHtml ? parseArticleHtml(contentHtml) : []),
            [contentHtml],
        )

        // As the web page: article links open in the in-app browser.
        const openLink = useCallback(
            (href: string) => {
                const url = toArticleLinkUrl(href)
                if (url !== null) openWebPage(url)
            },
            [openWebPage],
        )
        const refetch = query.refetch
        const retry = useCallback(() => {
            void refetch()
        }, [refetch])

        const isRetrying = query.isError && query.isFetching
        return {
            title: news?.title ?? '',
            dateDisplay: news ? formatNewsDate(news.publishedAt) : '',
            banner: news?.banner ?? null,
            blocks,
            isLoading: query.isLoading || isRetrying,
            isError: query.isError && !query.isFetching,
            retry,
            openLink,
        }
    }
