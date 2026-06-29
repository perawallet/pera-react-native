/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWebViewNavigationGuard } from '../useWebViewNavigationGuard'

const handleDeepLink = vi.fn()

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({ handleDeepLink }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const request = (url: string): any => ({ url, navigationType: 'click' })

describe('useWebViewNavigationGuard', () => {
    beforeEach(() => {
        handleDeepLink.mockReset()
    })

    it('allows http/https navigation to load inside the WebView', () => {
        const { result } = renderHook(() => useWebViewNavigationGuard())

        expect(
            result.current.onShouldStartLoadWithRequest(
                request('https://dapp.example/sign'),
            ),
        ).toBe(true)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('routes a Pera universal link (applink) in-app', () => {
        const { result } = renderHook(() => useWebViewNavigationGuard())

        const url =
            'https://perawallet.app/qr/perawallet/app/add-contact/?address=5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA&label=HELLO'
        expect(result.current.onShouldStartLoadWithRequest(request(url))).toBe(
            false,
        )
        expect(handleDeepLink).toHaveBeenCalledWith(url, false, 'deeplink')
    })

    it('loads a non-Pera https /app/ route instead of hijacking it as a deeplink', () => {
        const { result } = renderHook(() => useWebViewNavigationGuard())

        // The applink parser keys off a permissive `/app/` match; a foreign
        // host must still load as a page, never route to Pera's swap screen.
        expect(
            result.current.onShouldStartLoadWithRequest(
                request('https://dapp.example/app/swap'),
            ),
        ).toBe(true)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('lets non-deeplink custom schemes keep their default OS behaviour', () => {
        const { result } = renderHook(() => useWebViewNavigationGuard())

        expect(
            result.current.onShouldStartLoadWithRequest(
                request('mailto:support@example.com'),
            ),
        ).toBe(true)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('blocks and routes a recognised Pera deeplink in-app', () => {
        const { result } = renderHook(() => useWebViewNavigationGuard())

        const uri = 'wc:topic@1?bridge=https%3A%2F%2Fbridge.example&key=abc'
        expect(result.current.onShouldStartLoadWithRequest(request(uri))).toBe(
            false,
        )
        expect(handleDeepLink).toHaveBeenCalledWith(uri, false, 'deeplink')
    })

    it('blocks a WalletConnect wake link without routing it', () => {
        const { result } = renderHook(() => useWebViewNavigationGuard())

        // No bridge param → not an actionable deeplink, just a focus hint.
        expect(
            result.current.onShouldStartLoadWithRequest(
                request('perawallet-wc://?browser=pera'),
            ),
        ).toBe(false)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })
})
