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

// Native news: the list opens a detail, the detail renders the article from
// its HTML natively, https links push the in-app browser, unsafe ones stay
// text, and a failed load retries. Nothing here opens the Discover web app.

import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import {
    mockDiscoverNews,
    mockDiscoverNewsDetail,
} from '@perawallet/wallet-core-discover/test-handlers'
import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { useWebViewStore } from '@modules/webview'

const { DiscoverNewsScreen } =
    await import('@modules/discover/screens/DiscoverNewsScreen/DiscoverNewsScreen')
const { DiscoverNewsDetailScreen } =
    await import('@modules/discover/screens/DiscoverNewsDetailScreen/DiscoverNewsDetailScreen')

const ARTICLE = [
    '<h2>What changed</h2>',
    '<p>Pera is <strong>multichain</strong> now.</p>',
    '<ul><li>Ethereum</li><li>Base</li></ul>',
    '<p><a href="https://perawallet.app/blog">Read the blog</a>',
    ' and <a href="javascript:alert(1)">do not click</a></p>',
    '<script>document.title = "pwned"</script>',
].join('')

const item = (id: string, title: string) => ({
    id,
    title,
    banner: null,
    publishing_datetime: '2026-11-09T10:00:00Z',
})

const useList = () =>
    server.use(
        mockDiscoverNews({
            response: {
                next: null,
                previous: null,
                results: [item('n1', 'Multichain'), item('n2', 'Second')],
            },
        }),
    )

const useDetail = (contentHtml = ARTICLE) =>
    server.use(
        mockDiscoverNewsDetail({
            id: 'n1',
            response: {
                ...item('n1', 'Multichain'),
                content_html: contentHtml,
            },
        }),
    )

const flush = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
    })

const renderDetail = () =>
    renderWithNavigation(DiscoverNewsDetailScreen, 'DiscoverNewsDetail', {
        initialParams: { newsId: 'n1' },
        additionalScreens: [
            {
                name: 'DiscoverDetail',
                component: () => <div data-testid='detail_screen' />,
            },
        ],
    })

describe('Flow: Discover news', () => {
    beforeEach(() => {
        useWebViewStore.getState().clearWebViews()
    })

    it('Given the list, then cards show with Read and a card opens the detail', async () => {
        useList()
        useDetail()
        renderWithNavigation(DiscoverNewsScreen, 'DiscoverNews', {
            additionalScreens: [
                {
                    name: 'DiscoverNewsDetail',
                    component: DiscoverNewsDetailScreen,
                },
            ],
        })

        await screen.findByTestId('discover_news_card_n1')
        expect(screen.getAllByText('discover.news.read')).toHaveLength(2)

        fireEvent.click(screen.getByTestId('discover_news_card_n1'))

        expect(
            (await screen.findByTestId('discover_news_detail_title'))
                .textContent,
        ).toBe('Multichain')
        await flush()
    })

    it('Given an article, then it renders natively without the script', async () => {
        useDetail()
        renderDetail()

        await screen.findByText('What changed')
        expect(screen.getByText('multichain')).toBeTruthy()
        expect(screen.getByText('Ethereum')).toBeTruthy()
        expect(screen.getByText('Base')).toBeTruthy()
        expect(screen.queryByText(/pwned/)).toBeNull()
        expect(screen.queryByTestId('detail_screen')).toBeNull()
        await flush()
    })

    it('Given an https link, then a press opens it in the in-app browser', async () => {
        useDetail()
        renderDetail()

        fireEvent.click(await screen.findByText('Read the blog'))

        expect(useWebViewStore.getState().openWebViews.map(w => w.url)).toEqual(
            ['https://perawallet.app/blog'],
        )
        await flush()
    })

    it('Given a javascript: link, then it is plain text and opens nothing', async () => {
        useDetail()
        renderDetail()

        fireEvent.click(await screen.findByText('do not click'))

        expect(
            screen.getAllByTestId('discover_news_article_link'),
        ).toHaveLength(1)
        expect(useWebViewStore.getState().openWebViews).toEqual([])
        await flush()
    })

    it('Given an empty article, then the title still renders', async () => {
        useDetail('')
        renderDetail()

        expect(
            (await screen.findByTestId('discover_news_detail_title'))
                .textContent,
        ).toBe('Multichain')
        await flush()
    })

    it('Given the detail fails, then Retry loads the article', async () => {
        server.use(
            http.get('*/v1/discover/news/n1/', () =>
                HttpResponse.json({}, { status: 404 }),
            ),
        )
        renderDetail()

        await screen.findByTestId('discover_news_detail_error')
        useDetail()
        fireEvent.click(screen.getByTestId('discover_news_detail_retry'))

        await waitFor(() =>
            expect(screen.getByText('What changed')).toBeTruthy(),
        )
        await flush()
    })
})
