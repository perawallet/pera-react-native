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
import { parseDeeplink } from '@hooks/deeplink/parser'
import { DeeplinkType } from '@hooks/deeplink/types'

const mockHandleDeepLink = vi.fn()
const mockParseDeeplink = vi.fn()

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        handleDeepLink: mockHandleDeepLink,
        parseDeeplink: mockParseDeeplink,
    }),
}))

import { useBannerLinkRouter } from '../useBannerLinkRouter'

const ADDRESS = '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'
const WC_URI =
    'wc%3A7f6e504bfad60b485450578e05678ed3e8e8c4751d3c6160be17160d63ec90f9%402%3Frelay-protocol%3Dirn%26symKey%3D587d5484ce2a2a6ee3ba1962fdd7e8588e06200c46823bd18fbd67def96ad303'

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

    it('opens external URLs with Linking.openURL', () => {
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() =>
            result.current.route({
                url: 'https://example.com',
            }),
        )
        expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/')
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('routes internal deep links of an allowed type via handleDeepLink', () => {
        mockParseDeeplink.mockReturnValue({ type: DeeplinkType.STAKING })
        const { result } = renderHook(() => useBannerLinkRouter())
        act(() =>
            result.current.route({
                url: 'pera://staking',
            }),
        )
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            'pera://staking',
            false,
            'in-app',
        )
        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it.each([
        DeeplinkType.ALGO_TRANSFER,
        DeeplinkType.ASSET_TRANSFER,
        DeeplinkType.RECOVER_ADDRESS,
        DeeplinkType.PERA_WEB_IMPORT,
        DeeplinkType.WALLET_CONNECT,
        DeeplinkType.ADD_CONTACT,
        DeeplinkType.ADDRESS_ACTIONS,
    ])('refuses an internal %s banner deeplink', type => {
        mockParseDeeplink.mockReturnValue({ type })
        const { result } = renderHook(() => useBannerLinkRouter())

        act(() =>
            result.current.route({
                url: 'perawallet://app/whatever',
            }),
        )

        expect(mockHandleDeepLink).not.toHaveBeenCalled()
        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it.each([
        ['tel:', 'tel:+15551234567'],
        ['mailto:', 'mailto:support@perawallet.app'],
        ['itms-apps:', 'itms-apps://apps.apple.com/app/id1459898525'],
    ])('opens a %s banner URL', (_label, url) => {
        const { result } = renderHook(() => useBannerLinkRouter())

        act(() => result.current.route({ url }))

        expect(Linking.openURL).toHaveBeenCalledWith(url)
    })

    it.each([
        ['javascript:', 'javascript:alert(1)'],
        ['http:', 'http://example.com'],
        ['scheme-relative', '//evil.example.com'],
        ['third-party app', 'sms:+15551234567'],
        ['file:', 'file:///etc/passwd'],
    ])('never opens a %s banner URL', (_label, url) => {
        const { result } = renderHook(() => useBannerLinkRouter())

        act(() => result.current.route({ url }))

        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('never opens an unparsed URL in an app scheme outside the allowlist', () => {
        const { result } = renderHook(() => useBannerLinkRouter())

        act(() => result.current.route({ url: 'pera://keyreg' }))

        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('gates an https Pera link the CMS could otherwise route past the policy', () => {
        mockParseDeeplink.mockReturnValue({ type: DeeplinkType.KEYREG })
        const { result } = renderHook(() => useBannerLinkRouter())

        act(() =>
            result.current.route({
                url: 'https://perawallet.app/app/keyreg?address=AAA',
            }),
        )

        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).not.toHaveBeenCalled()
    })

    it('classifies the normalized URL, not the raw one the CMS sent', () => {
        mockParseDeeplink.mockImplementation((url: string) =>
            url.startsWith('https://')
                ? { type: DeeplinkType.ASSET_OPT_IN }
                : null,
        )
        const { result } = renderHook(() => useBannerLinkRouter())

        act(() =>
            result.current.route({
                url: 'perawallet.app/qr/perawallet/asset/opt-in?asset=31566704',
            }),
        )

        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(mockHandleDeepLink).toHaveBeenCalledWith(
            'https://perawallet.app/qr/perawallet/asset/opt-in?asset=31566704',
            false,
            'in-app',
        )
    })

    it('normalizes a bare domain before opening it', () => {
        const { result } = renderHook(() => useBannerLinkRouter())

        act(() =>
            result.current.route({
                url: 'perawallet.app/discover',
            }),
        )

        expect(Linking.openURL).toHaveBeenCalledWith(
            'https://perawallet.app/discover',
        )
    })

    describe('with the real parser', () => {
        beforeEach(() => {
            mockParseDeeplink.mockImplementation(parseDeeplink)
        })

        it('dispatches an HTTPS-spelled opt-in link in canonical form instead of opening it', () => {
            const { result } = renderHook(() => useBannerLinkRouter())

            act(() =>
                result.current.route({
                    url: 'HTTPS://perawallet.app/qr/perawallet/asset/opt-in?asset=1',
                }),
            )

            expect(mockHandleDeepLink).toHaveBeenCalledWith(
                'https://perawallet.app/qr/perawallet/asset/opt-in?asset=1',
                false,
                'in-app',
            )
            expect(Linking.openURL).not.toHaveBeenCalled()
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
