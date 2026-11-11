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
import { waitFor } from '@testing-library/react'

import { config } from '@perawallet/wallet-core-config'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'

const webViewSpy = vi.fn()
const webViewPropsSpy = vi.fn()

vi.mock('@modules/webview/components/PWWebView', () => ({
    PWWebView: (props: { url: string }) => {
        webViewSpy(props.url)
        webViewPropsSpy(props)
        return null
    },
}))

const { DiscoverDetailScreen } =
    await import('@modules/discover/screens/DiscoverDetailScreen/DiscoverDetailScreen')

const baseUrl = config.discoverBaseUrl.endsWith('/')
    ? config.discoverBaseUrl.slice(0, -1)
    : config.discoverBaseUrl

describe('Flow: Discover detail — pushed page keeps a way back', () => {
    beforeEach(() => {
        webViewSpy.mockClear()
        webViewPropsSpy.mockClear()
    })

    it('Given a token-detail path, when the detail screen mounts, then the webview loads that page and wires back/close to navigation', async () => {
        renderWithNavigation(DiscoverDetailScreen, 'DiscoverDetail', {
            initialParams: { path: 'token-detail/ALGO' },
        })

        await waitFor(() => expect(webViewSpy).toHaveBeenCalled())

        expect(webViewSpy).toHaveBeenLastCalledWith(
            `${baseUrl}/token-detail/ALGO`,
        )
        const props = webViewPropsSpy.mock.lastCall?.[0]
        expect(props.onBack).toBeTypeOf('function')
        expect(props.onClose).toBeTypeOf('function')
    })

    it('Given an unsafe path param, when the detail screen mounts, then only the base URL is loaded', async () => {
        renderWithNavigation(DiscoverDetailScreen, 'DiscoverDetail', {
            initialParams: { path: 'https://evil.com' },
        })

        await waitFor(() => expect(webViewSpy).toHaveBeenCalled())

        expect(webViewSpy).toHaveBeenLastCalledWith(config.discoverBaseUrl)
    })
})
