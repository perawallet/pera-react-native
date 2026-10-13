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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePushWebViewHandler } from '../usePushWebViewHandler'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    injectedScript,
    languageMockValue,
    lastAction,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => languageMockValue(),
}))

const mockPushWebView = vi.fn()
vi.mock('../../useWebViewStore', () => ({
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

type PushedWebView = {
    url: string
    favorite?: { initialIsFavorite: boolean; onToggle: () => void }
}

const lastPushed = (): PushedWebView =>
    mockPushWebView.mock.calls.at(-1)?.[0] as PushedWebView

describe('usePushWebViewHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const render = (
        callbacks: {
            onCloseRequested?: () => void
            onBackRequested?: () => void
        } = {},
    ) => {
        const webview = createMockWebview()
        const { result } = renderHook(() =>
            usePushWebViewHandler({ webview, ...callbacks }),
        )
        return { webview, handle: result.current }
    }

    it('pushes a stacked webview carrying the message id and host callbacks', () => {
        const onCloseRequested = vi.fn()
        const onBackRequested = vi.fn()
        const { handle } = render({ onCloseRequested, onBackRequested })

        handle(
            bridgeMessage('12', 'pushWebView', { url: 'https://example.com' }),
            TRUSTED,
        )

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://example.com',
            id: '12',
            onCloseRequested,
            onBackRequested,
            enablePeraConnect: true,
            favorite: undefined,
        })
    })

    it('seeds the favorite state and toggles it through the source webview', () => {
        const { webview, handle } = render()

        handle(
            bridgeMessage('pw-2', 'pushWebView', {
                url: 'https://dapp.example',
                title: 'Example Dapp',
                isFavorite: true,
            }),
            TRUSTED,
        )
        const { favorite } = lastPushed()
        act(() => favorite?.onToggle())

        expect(favorite?.initialIsFavorite).toBe(true)
        expect(lastAction(webview)).toEqual({
            action: 'handleBrowserFavoriteButtonClick',
            payload: {
                name: 'Example Dapp',
                url: 'https://dapp.example',
                logo: null,
            },
        })
    })

    it('normalizes a bare domain to https before the safety gate, favorite payload included', () => {
        const { webview, handle } = render()

        handle(
            bridgeMessage('pw-bare', 'pushWebView', {
                url: 'perawallet.app',
                title: 'Pera',
                isFavorite: false,
            }),
            TRUSTED,
        )
        const pushed = lastPushed()
        act(() => pushed.favorite?.onToggle())

        expect(pushed.url).toBe('https://perawallet.app')
        expect(lastAction(webview)).toMatchObject({
            payload: { url: 'https://perawallet.app' },
        })
    })

    const unsafeUrls: Array<[string, string]> = [
        ['http:', 'http://example.com'],
        ['data:', 'data:text/html,<script>x</script>'],
        ['file:', 'file:///etc/passwd'],
        ['javascript:', 'javascript:alert(1)'],
        ['blob:', 'blob:https://example.com/uuid'],
        ['scheme-relative', '//evil.com/page'],
    ]

    it.each(unsafeUrls)(
        'rejects %s URLs with InvalidParams',
        (_scheme, url) => {
            const { webview, handle } = render()

            handle(
                bridgeMessage('scheme-push', 'pushWebView', { url }),
                TRUSTED,
            )

            expect(mockPushWebView).not.toHaveBeenCalled()
            const sent = injectedScript(webview)
            expect(sent).toContain('"code":-32602')
            expect(sent).toContain(`Unsupported URL: ${url}`)
        },
    )

    it('answers InvalidParams when the url is missing', () => {
        const { webview, handle } = render()

        handle(bridgeMessage('18', 'pushWebView'), TRUSTED)

        expect(mockPushWebView).not.toHaveBeenCalled()
        expect(injectedScript(webview)).toContain('"code":-32602')
    })
})
