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

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWebViewMessageSecurity } from '../useWebViewMessageSecurity'

import type { WebViewMessageEvent } from 'react-native-webview'

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { discoverBaseUrl: 'https://discover.example.app/' },
}))

const messageEvent = (url: string): WebViewMessageEvent =>
    ({ nativeEvent: { url, data: '{}' } }) as WebViewMessageEvent

describe('useWebViewMessageSecurity', () => {
    it('trusts a message whose event URL is on the trusted origin', () => {
        const { result } = renderHook(() =>
            useWebViewMessageSecurity('https://discover.example.app/'),
        )

        expect(
            result.current.resolveMessageSecurity(
                messageEvent('https://discover.example.app/markets?tab=1'),
            ),
        ).toEqual({
            securedConnection: true,
            sourceUrl: 'https://discover.example.app/markets?tab=1',
        })
    })

    it('trusts the origin-only URL form Android reports for the posting frame', () => {
        const { result } = renderHook(() =>
            useWebViewMessageSecurity('https://discover.example.app/'),
        )

        expect(
            result.current.resolveMessageSecurity(
                messageEvent('https://discover.example.app'),
            ).securedConnection,
        ).toBe(true)
    })

    it('evaluates a message against its own URL even while the tracked navigation is still the trusted origin', () => {
        const { result } = renderHook(() =>
            useWebViewMessageSecurity('https://discover.example.app/'),
        )

        const security = result.current.resolveMessageSecurity(
            messageEvent('https://evil.example/'),
        )

        expect(security).toEqual({
            securedConnection: false,
            sourceUrl: 'https://evil.example/',
        })
    })

    it('falls back to the last tracked navigation URL when the event carries none', () => {
        const { result } = renderHook(() =>
            useWebViewMessageSecurity('https://discover.example.app/'),
        )

        result.current.trackNavigation('https://evil.example/page')

        expect(result.current.resolveMessageSecurity(messageEvent(''))).toEqual(
            {
                securedConnection: false,
                sourceUrl: 'https://evil.example/page',
            },
        )
    })

    it('falls back to the initial load URL before any navigation was tracked', () => {
        const { result } = renderHook(() =>
            useWebViewMessageSecurity('https://discover.example.app/'),
        )

        expect(result.current.resolveMessageSecurity(messageEvent(''))).toEqual(
            {
                securedConnection: true,
                sourceUrl: 'https://discover.example.app/',
            },
        )
    })
})
