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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DiscoverEvent, trackEvent } from '@analytics'
import { useWebView } from '@modules/webview'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../types'
import { useOpenDapp } from '../useOpenDapp'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics')),
    trackEvent: vi.fn(),
}))
vi.mock('@modules/webview', async () => ({
    ...(await vi.importActual<object>('@modules/webview')),
    useWebView: vi.fn(),
}))

const pushWebView = vi.fn()

const dapp = (url: string): DiscoverDapp => ({
    url,
    name: 'A',
    logo: null,
    categories: [],
    chains: [],
})

describe('useOpenDapp', () => {
    beforeEach(() => {
        useDiscoverFavoritesStore.setState({ favorites: {}, favoriteOrder: [] })
        pushWebView.mockClear()
        vi.mocked(trackEvent).mockClear()
        vi.mocked(useWebView).mockReturnValue({
            pushWebView,
            removeWebView: vi.fn(),
        })
    })

    it('opens a dapp with the favorite hook and tracks the open', () => {
        const { result } = renderHook(() => useOpenDapp())
        result.current.openDapp(dapp('https://a.io'), 'algorand')
        expect(pushWebView).toHaveBeenCalledWith({
            url: 'https://a.io',
            enablePeraConnect: true,
            favorite: {
                initialIsFavorite: false,
                onToggle: expect.any(Function),
            },
        })
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.DappOpenTap, {
            dapp_name: 'A',
            dapp_url: 'https://a.io',
            chain_id: 'algorand',
        })
    })

    it('the pushed onToggle favorites the url and tracks it', () => {
        const { result } = renderHook(() => useOpenDapp())
        result.current.openDapp(dapp('https://a.io'), null)
        pushWebView.mock.calls[0]?.[0].favorite.onToggle()
        expect(
            useDiscoverFavoritesStore.getState().isFavorite('https://a.io'),
        ).toBe(true)
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DappFavoriteTap,
            { dapp_name: 'A', dapp_url: 'https://a.io' },
        )
    })

    it('reports an existing favorite as initialIsFavorite', () => {
        useDiscoverFavoritesStore.getState().addFavorite(dapp('https://a.io'))
        const { result } = renderHook(() => useOpenDapp())
        result.current.openDapp(dapp('https://a.io/'), null)
        expect(pushWebView.mock.calls[0]?.[0].favorite.initialIsFavorite).toBe(
            true,
        )
    })

    it('keeps a typed query and hash out of the open and favorite events', () => {
        const { result } = renderHook(() => useOpenDapp())
        result.current.openDapp(
            dapp('https://uniswap.org/swap?token=secret#frag'),
            null,
        )
        expect(trackEvent).toHaveBeenCalledWith(DiscoverEvent.DappOpenTap, {
            dapp_name: 'A',
            dapp_url: 'https://uniswap.org/swap',
        })
        pushWebView.mock.calls[0]?.[0].favorite.onToggle()
        expect(trackEvent).toHaveBeenLastCalledWith(
            DiscoverEvent.DappFavoriteTap,
            { dapp_name: 'A', dapp_url: 'https://uniswap.org/swap' },
        )
    })

    it('pushes nothing for an invalid dapp url', () => {
        const { result } = renderHook(() => useOpenDapp())
        result.current.openDapp(dapp('http://x.io'), null)
        expect(pushWebView).not.toHaveBeenCalled()
        expect(trackEvent).not.toHaveBeenCalled()
    })

    it('openWebPage pushes without favorite or event', () => {
        const { result } = renderHook(() => useOpenDapp())
        result.current.openWebPage('https://duckduckgo.com/?q=a')
        expect(pushWebView).toHaveBeenCalledWith({
            url: 'https://duckduckgo.com/?q=a',
            enablePeraConnect: true,
        })
        expect(trackEvent).not.toHaveBeenCalled()
    })

    it('openWebPage refuses javascript: urls', () => {
        const { result } = renderHook(() => useOpenDapp())
        result.current.openWebPage('javascript:alert(1)')
        expect(pushWebView).not.toHaveBeenCalled()
    })
})
