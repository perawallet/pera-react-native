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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'

import { config } from '@perawallet/wallet-core-config'

import { renderWithNavigation } from '@test-utils/renderWithNavigation'

const webViewSpy = vi.fn()

vi.mock('@modules/webview/components/PWWebView', () => ({
    PWWebView: (props: { url: string }) => {
        webViewSpy(props.url)
        return null
    },
}))

const { DiscoverScreen } =
    await import('@modules/discover/screens/DiscoverScreen/DiscoverScreen')

const baseUrl = config.discoverBaseUrl.endsWith('/')
    ? config.discoverBaseUrl.slice(0, -1)
    : config.discoverBaseUrl

describe('Flow: Discover — webview URL building', () => {
    beforeEach(() => {
        webViewSpy.mockClear()
    })

    afterEach(() => {
        webViewSpy.mockClear()
    })

    it('Given a safe relative path param, when Discover mounts, then the path is appended to the discover base URL', async () => {
        renderWithNavigation(DiscoverScreen, 'Discover', {
            initialParams: { path: 'markets/algo' },
        })

        await waitFor(() => expect(webViewSpy).toHaveBeenCalled())

        expect(webViewSpy).toHaveBeenLastCalledWith(`${baseUrl}/markets/algo`)
    })

    it('Given an absolute http URL as the path param, when Discover mounts, then it is rejected and only the base URL is used', async () => {
        renderWithNavigation(DiscoverScreen, 'Discover', {
            initialParams: { path: 'https://evil.com' },
        })

        await waitFor(() => expect(webViewSpy).toHaveBeenCalled())

        expect(webViewSpy).toHaveBeenLastCalledWith(config.discoverBaseUrl)
    })

    it('Given a javascript: scheme as the path param, when Discover mounts, then it is rejected and only the base URL is used', async () => {
        renderWithNavigation(DiscoverScreen, 'Discover', {
            initialParams: { path: 'javascript:alert(1)' },
        })

        await waitFor(() => expect(webViewSpy).toHaveBeenCalled())

        expect(webViewSpy).toHaveBeenLastCalledWith(config.discoverBaseUrl)
    })

    it('Given no path param, when Discover mounts, then the bare discover base URL is used', async () => {
        renderWithNavigation(DiscoverScreen, 'Discover')

        await waitFor(() => expect(webViewSpy).toHaveBeenCalled())

        expect(webViewSpy).toHaveBeenLastCalledWith(config.discoverBaseUrl)
    })
})
