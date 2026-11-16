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
import type { WebViewMessageEvent } from 'react-native-webview'
import { config } from '@perawallet/wallet-core-config'
import { useLegacyFavoritesImport } from '../../../hooks/useLegacyFavoritesImport'
import { useLegacyFavoritesImporter } from '../useLegacyFavoritesImporter'

vi.mock('../../../hooks/useLegacyFavoritesImport', () => ({
    useLegacyFavoritesImport: vi.fn(),
}))

const onMessage = vi.fn()
const onFailure = vi.fn()

const messageEvent = (url: string, data: string) =>
    ({ nativeEvent: { url, data } }) as WebViewMessageEvent

describe('useLegacyFavoritesImporter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useLegacyFavoritesImport).mockReturnValue({
            isActive: true,
            onMessage,
            onFailure,
        })
    })

    it('passes isActive through', () => {
        const { result } = renderHook(() => useLegacyFavoritesImporter())

        expect(result.current.isActive).toBe(true)
    })

    it('loads the Discover origin hardened, routing every scheme through the guard', () => {
        const { result } = renderHook(() => useLegacyFavoritesImporter())

        expect(result.current.webViewProps).toMatchObject({
            source: { uri: config.discoverBaseUrl },
            originWhitelist: ['*'],
            allowFileAccess: false,
            javaScriptCanOpenWindowsAutomatically: false,
            setSupportMultipleWindows: false,
            thirdPartyCookiesEnabled: false,
            mixedContentMode: 'never',
        })
    })

    it('refuses a custom-scheme navigation', () => {
        const { result } = renderHook(() => useLegacyFavoritesImporter())

        expect(
            result.current.webViewProps.onShouldStartLoadWithRequest({
                url: 'perawallet://wc?uri=x',
            } as never),
        ).toBe(false)
    })

    it('only lets the Discover origin load', () => {
        const { result } = renderHook(() => useLegacyFavoritesImporter())

        expect(
            result.current.webViewProps.onShouldStartLoadWithRequest({
                url: `${config.discoverBaseUrl}/browser`,
            } as never),
        ).toBe(true)
        expect(
            result.current.webViewProps.onShouldStartLoadWithRequest({
                url: 'https://evil.io',
            } as never),
        ).toBe(false)
    })

    it('forwards a message with the url it came from', () => {
        const { result } = renderHook(() => useLegacyFavoritesImporter())

        result.current.webViewProps.onMessage(
            messageEvent(
                'https://discover.example/',
                JSON.stringify({ type: 't', favorites: [] }),
            ),
        )

        expect(onMessage).toHaveBeenCalledWith('https://discover.example/', {
            type: 't',
            favorites: [],
        })
    })

    it('forwards unparseable data as undefined, which fails as malformed', () => {
        const { result } = renderHook(() => useLegacyFavoritesImporter())

        result.current.webViewProps.onMessage(
            messageEvent('https://discover.example/', '{oops'),
        )

        expect(onMessage).toHaveBeenCalledWith(
            'https://discover.example/',
            undefined,
        )
    })

    it('reports load and http errors', () => {
        const { result } = renderHook(() => useLegacyFavoritesImporter())

        result.current.webViewProps.onError()
        result.current.webViewProps.onHttpError()

        expect(onFailure).toHaveBeenNthCalledWith(1, 'load_error')
        expect(onFailure).toHaveBeenNthCalledWith(2, 'http_error')
    })
})
