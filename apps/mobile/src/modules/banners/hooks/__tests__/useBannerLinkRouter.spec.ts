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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Linking } from 'react-native'
import { parseDeeplink } from '@modules/deeplink/parser'
import { DeeplinkType } from '@modules/deeplink/types'

const mockHandleDeepLink = vi.fn()
const mockParseDeeplink = vi.fn()

vi.mock('@modules/deeplink/hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        handleDeepLink: mockHandleDeepLink,
        parseDeeplink: mockParseDeeplink,
    }),
}))

import { useBannerLinkRouter } from '../useBannerLinkRouter'

const ADDRESS = 'M5RQKWSELEVRKEHAZ4CD62ZO5TY76ZLZXXS6VBQ3ACUFWKJGBRJGKOUS7I'
const WC_URI = encodeURIComponent('wc:abc@2?relay-protocol=irn&symKey=x')

beforeEach(() => {
    mockHandleDeepLink.mockReset()
    mockParseDeeplink.mockReset()
    mockParseDeeplink.mockReturnValue(null)
    vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
})

describe('useBannerLinkRouter', () => {
    it('no-ops when URL is null', () => {
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() => result.current.route({ url: null }))
        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('opens an https URL that is not a deeplink', () => {
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() => result.current.route({ url: 'https://example.com' }))
        expect(Linking.openURL).toHaveBeenCalledWith('https://example.com')
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('dispatches a deeplink the notification policy admits', () => {
        mockParseDeeplink.mockReturnValue({ type: DeeplinkType.STAKING })
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() => result.current.route({ url: 'pera://staking' }))
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            'pera://staking',
            false,
            'in-app',
        )
        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it('refuses a deeplink the notification policy does not admit', () => {
        mockParseDeeplink.mockReturnValue({ type: DeeplinkType.KEYREG })
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() =>
            result.current.route({
                url: 'https://perawallet.app/app/keyreg?address=AAA',
            }),
        )
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it('classifies the normalized URL, not the raw one the CMS sent', () => {
        mockParseDeeplink.mockImplementation((url: string) =>
            url.startsWith('https://') ? { type: DeeplinkType.STAKING } : null,
        )
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() =>
            result.current.route({
                url: 'perawallet.app/qr/perawallet/staking',
            }),
        )
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            'https://perawallet.app/qr/perawallet/staking',
            false,
            'in-app',
        )
        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it.each([
        ['custom scheme', 'algorand://ATTACKER?amount=1'],
        ['cleartext', 'http://example.com'],
        ['protocol-relative', '//evil.example'],
        ['script', 'javascript:alert(1)'],
    ])('refuses to open a %s URL', (_label, url) => {
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() => result.current.route({ url }))
        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it('opens a scheme-less URL as absolute https, never relative to the current page', () => {
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() => result.current.route({ url: 'expanded.html?deeplink=x' }))
        expect(Linking.openURL).toHaveBeenCalledWith(
            'https://expanded.html?deeplink=x',
        )
    })

    describe('with the real parser', () => {
        beforeEach(() => {
            mockParseDeeplink.mockImplementation(parseDeeplink)
        })

        it.each([
            [
                'an HTTPS-spelled transfer link',
                `HTTPS://perawallet.app/qr/perawallet/${ADDRESS}?amount=1000000`,
            ],
            [
                'an upper-case WalletConnect pairing link',
                `HTTPS://PERAWALLET.APP/qr/perawallet-wc/wc?uri=${WC_URI}`,
            ],
            [
                'an App Link path that does not parse',
                'https://perawallet.app/qr/perawallet/app/not-an-action',
            ],
        ])('neither dispatches nor opens %s', (_label, url) => {
            const { result } = renderHook(() => useBannerLinkRouter())
            act(() => result.current.route({ url }))
            expect(mockHandleDeepLink).not.toHaveBeenCalled()
            expect(Linking.openURL).not.toHaveBeenCalled()
        })

        it('opens a lowercase https link that is not a Pera deeplink', () => {
            const { result } = renderHook(() => useBannerLinkRouter())
            act(() =>
                result.current.route({ url: 'https://example.com/promo' }),
            )
            expect(Linking.openURL).toHaveBeenCalledWith(
                'https://example.com/promo',
            )
            expect(mockHandleDeepLink).not.toHaveBeenCalled()
        })
    })
})
