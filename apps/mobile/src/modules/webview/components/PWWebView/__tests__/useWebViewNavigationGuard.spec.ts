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
import { useWebViewNavigationGuard } from '../useWebViewNavigationGuard'

const handleDeepLink = vi.fn()

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({ handleDeepLink }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const request = (url: string, isTopFrame = true): any => ({
    url,
    navigationType: 'click',
    isTopFrame,
})

const renderGuard = (isTrustedOrigin: boolean) =>
    renderHook(() =>
        useWebViewNavigationGuard({
            isTrustedOrigin,
            pageUrl: isTrustedOrigin
                ? 'https://discover.perawallet.app/'
                : 'https://evil.example/',
        }),
    )

// The social branch reads install results pre-warmed in a mount effect, so
// these renders flush that promise chain before asserting.
const renderSocialGuard = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webviewRef?: any,
    isTrustedOrigin = true,
) => {
    const rendered = renderHook(() =>
        useWebViewNavigationGuard({
            isTrustedOrigin,
            pageUrl: isTrustedOrigin
                ? 'https://discover.perawallet.app/'
                : 'https://evil.example/',
            webviewRef,
        }),
    )
    await act(async () => {})
    return rendered
}

const RECEIVER = '5CYNWZY5JO7RWAPEQLWOTDULMDSSKJ55PHXNRTGZXUR62B7PR7JIDJGHEA'

describe('useWebViewNavigationGuard', () => {
    beforeEach(() => {
        handleDeepLink.mockReset()
        // Default to "no social app installed" so the guard's mount probes
        // resolve false and only the social tests opt into a handoff.
        vi.spyOn(Linking, 'canOpenURL').mockReset().mockResolvedValue(false)
        vi.spyOn(Linking, 'openURL').mockReset().mockResolvedValue(true)
    })

    it('allows http/https navigation to load inside the WebView', () => {
        const { result } = renderGuard(false)

        expect(
            result.current.onShouldStartLoadWithRequest(
                request('https://dapp.example/sign'),
            ),
        ).toBe(true)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('routes a navigation-only Pera universal link (applink) in-app from any origin', () => {
        const { result } = renderGuard(false)

        const url = 'https://perawallet.app/qr/perawallet/app/staking/'
        expect(result.current.onShouldStartLoadWithRequest(request(url))).toBe(
            false,
        )
        expect(handleDeepLink).toHaveBeenCalledWith(url, false, 'in-app')
    })

    it('blocks add-contact from an untrusted page (saved labels mask addresses)', () => {
        // A contact named "Ledger Cold Storage" becomes the primary label on
        // every future send confirmation, hiding the address.
        const { result } = renderGuard(false)

        expect(
            result.current.onShouldStartLoadWithRequest(
                request(
                    `https://perawallet.app/qr/perawallet/app/add-contact/?address=${RECEIVER}&label=HELLO`,
                ),
            ),
        ).toBe(false)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('loads a non-Pera https /app/ route instead of hijacking it as a deeplink', () => {
        const { result } = renderGuard(false)

        // The applink parser keys off a permissive `/app/` match; a foreign
        // host must still load as a page, never route to Pera's swap screen.
        expect(
            result.current.onShouldStartLoadWithRequest(
                request('https://dapp.example/app/swap'),
            ),
        ).toBe(true)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('opens mailto through the OS and refuses the navigation', () => {
        // originWhitelist={['*']} means react-native-webview no longer
        // Linking.openURL's these itself, and the WebView can't load a foreign
        // scheme — returning true stranded the page on an error view.
        const { result } = renderGuard(false)

        expect(
            result.current.onShouldStartLoadWithRequest(
                request('mailto:support@example.com'),
            ),
        ).toBe(false)
        expect(Linking.openURL).toHaveBeenCalledWith(
            'mailto:support@example.com',
        )
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('routes a WC pairing deeplink fired by the trusted Discover origin', () => {
        const { result } = renderGuard(true)

        const uri = 'wc:topic@1?bridge=https%3A%2F%2Fbridge.example&key=abc'
        expect(result.current.onShouldStartLoadWithRequest(request(uri))).toBe(
            false,
        )
        expect(handleDeepLink).toHaveBeenCalledWith(uri, false, 'in-app')
    })

    it('blocks a WC pairing deeplink fired by an untrusted origin without routing it', () => {
        const { result } = renderGuard(false)

        const uri = 'wc:topic@1?bridge=https%3A%2F%2Fbridge.example&key=abc'
        expect(result.current.onShouldStartLoadWithRequest(request(uri))).toBe(
            false,
        )
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('blocks a WalletConnect wake link without routing it', () => {
        const { result } = renderGuard(false)

        // No bridge param → not an actionable deeplink, just a focus hint.
        expect(
            result.current.onShouldStartLoadWithRequest(
                request('perawallet-wc://?browser=pera'),
            ),
        ).toBe(false)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('blocks an untrusted page firing an ALGO transfer deeplink', () => {
        const { result } = renderGuard(false)

        expect(
            result.current.onShouldStartLoadWithRequest(
                request(`algorand://${RECEIVER}?amount=1000000&note=pay`),
            ),
        ).toBe(false)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('routes the same ALGO transfer deeplink from the trusted Discover origin', () => {
        const { result } = renderGuard(true)

        const url = `algorand://${RECEIVER}?amount=1000000&note=pay`
        expect(result.current.onShouldStartLoadWithRequest(request(url))).toBe(
            false,
        )
        expect(handleDeepLink).toHaveBeenCalledWith(url, false, 'in-app')
    })

    it('blocks an untrusted page firing an asset transfer deeplink', () => {
        const { result } = renderGuard(false)

        expect(
            result.current.onShouldStartLoadWithRequest(
                request(`algorand://${RECEIVER}?amount=5&asset=31566704`),
            ),
        ).toBe(false)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('blocks an untrusted page firing a value-bearing Pera universal link', () => {
        const { result } = renderGuard(false)

        expect(
            result.current.onShouldStartLoadWithRequest(
                request(
                    `https://perawallet.app/qr/perawallet/${RECEIVER}?amount=1000000`,
                ),
            ),
        ).toBe(false)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })
    it('blocks receiver-account-selection, which pre-fills Send via openSendFunds', () => {
        // Regression: the gate was a 5-type denylist, so this sibling of
        // ALGO_TRANSFER reached `openSendFunds({ destination })` from any page.
        const { result } = renderGuard(false)

        expect(
            result.current.onShouldStartLoadWithRequest(
                request(
                    `perawallet://app/receiver-account-selection?address=${RECEIVER}`,
                ),
            ),
        ).toBe(false)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it.each([
        [
            'asset opt-in (on-chain txn + MBR)',
            'perawallet://app/asset-opt-in?assetId=31566704',
        ],
        ['sign request', 'perawallet://app/sign-request?signRequestId=abc'],
        [
            'edit contact (address-book poisoning)',
            `perawallet://app/edit-contact?address=${RECEIVER}&label=Cold`,
        ],
        [
            'swap (switches selected account)',
            `perawallet://app/swap?address=${RECEIVER}`,
        ],
    ])('blocks %s from an untrusted page', (_label, url) => {
        const { result } = renderGuard(false)

        expect(result.current.onShouldStartLoadWithRequest(request(url))).toBe(
            false,
        )
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    it('blocks a gated deeplink fired from a subframe of the trusted origin', () => {
        // isTrustedOrigin is derived from the TOP frame, so a cross-origin
        // iframe on Discover would otherwise inherit Discover's trust. iOS
        // reports isTopFrame: false here; Android hardcodes true.
        const { result } = renderGuard(true)

        expect(
            result.current.onShouldStartLoadWithRequest(
                request(`algorand://${RECEIVER}?amount=1000000`, false),
            ),
        ).toBe(false)
        expect(handleDeepLink).not.toHaveBeenCalled()
    })

    describe('social media handoff', () => {
        it('opens the native app and blocks the web load when installed', async () => {
            vi.mocked(Linking.canOpenURL).mockResolvedValue(true)
            const { result } = await renderSocialGuard()

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('https://twitter.com/PeraAlgoWallet'),
                ),
            ).toBe(false)
            expect(Linking.openURL).toHaveBeenCalledWith(
                'twitter://user?screen_name=PeraAlgoWallet',
            )
            expect(handleDeepLink).not.toHaveBeenCalled()
        })

        it('hands off from an untrusted origin too — opening X is not a wallet capability', async () => {
            vi.mocked(Linking.canOpenURL).mockResolvedValue(true)
            const { result } = await renderSocialGuard(undefined, false)

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('https://twitter.com/PeraAlgoWallet'),
                ),
            ).toBe(false)
            expect(Linking.openURL).toHaveBeenCalledWith(
                'twitter://user?screen_name=PeraAlgoWallet',
            )
            expect(handleDeepLink).not.toHaveBeenCalled()
        })

        it('routes a social app-scheme link straight to the installed app', async () => {
            vi.mocked(Linking.canOpenURL).mockResolvedValue(true)
            const { result } = await renderSocialGuard()

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('tg://resolve?domain=PeraWallet'),
                ),
            ).toBe(false)
            expect(Linking.openURL).toHaveBeenCalledWith(
                'tg://resolve?domain=PeraWallet',
            )
        })

        it('falls through to the in-app web load when the app is not installed', async () => {
            const { result } = await renderSocialGuard()

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('https://t.me/PeraWallet'),
                ),
            ).toBe(true)
            expect(Linking.openURL).not.toHaveBeenCalled()
        })

        it('drives the web load itself when the handoff fails, so the tap is not swallowed', async () => {
            vi.mocked(Linking.canOpenURL).mockResolvedValue(true)
            vi.mocked(Linking.openURL).mockRejectedValue(new Error('no app'))
            const injectJavaScript = vi.fn()
            const { result } = await renderSocialGuard({
                current: { injectJavaScript },
            })

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('https://x.com/perawallet'),
                ),
            ).toBe(false)

            await act(async () => {})

            expect(injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('https://x.com/perawallet'),
            )
        })

        it('treats a failing install check as not installed', async () => {
            vi.mocked(Linking.canOpenURL).mockRejectedValue(
                new Error('unsupported'),
            )
            const { result } = await renderSocialGuard()

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('https://discord.com/invite/gR2UdkCTXQ'),
                ),
            ).toBe(true)
            expect(Linking.openURL).not.toHaveBeenCalled()
        })

        it('loads reserved twitter paths in the webview even when the app is installed', async () => {
            vi.mocked(Linking.canOpenURL).mockResolvedValue(true)
            const { result } = await renderSocialGuard()

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('https://twitter.com/home'),
                ),
            ).toBe(true)
            expect(Linking.openURL).not.toHaveBeenCalled()
        })
    })

    describe('external-navigation handoff', () => {
        const HOST = 'https://discover.example/main'
        const renderWithHandoff = (
            onExternalNavigation: (url: string) => void,
        ) =>
            renderHook(() =>
                useWebViewNavigationGuard({
                    isTrustedOrigin: true,
                    pageUrl: HOST,
                    externalNavigation: { hostUrl: HOST, onExternalNavigation },
                }),
            )

        it('hands a top-frame navigation off the host origin to the in-app browser', () => {
            const onExternalNavigation = vi.fn()
            const { result } = renderWithHandoff(onExternalNavigation)

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('https://akita.community/'),
                ),
            ).toBe(false)
            expect(onExternalNavigation).toHaveBeenCalledWith(
                'https://akita.community/',
            )
        })

        it('keeps same-origin navigation loading in place', () => {
            const onExternalNavigation = vi.fn()
            const { result } = renderWithHandoff(onExternalNavigation)

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('https://discover.example/asset/523683256'),
                ),
            ).toBe(true)
            expect(onExternalNavigation).not.toHaveBeenCalled()
        })

        it('ignores subframe navigations so an iframe cannot spawn a browser sheet', () => {
            const onExternalNavigation = vi.fn()
            const { result } = renderWithHandoff(onExternalNavigation)

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('https://ads.example/frame', false),
                ),
            ).toBe(true)
            expect(onExternalNavigation).not.toHaveBeenCalled()
        })

        it('still routes a Pera universal link as a deeplink rather than handing it off', () => {
            const onExternalNavigation = vi.fn()
            const { result } = renderWithHandoff(onExternalNavigation)

            const url = `https://perawallet.app/qr/perawallet/app/add-contact/?address=${RECEIVER}&label=HELLO`
            expect(
                result.current.onShouldStartLoadWithRequest(request(url)),
            ).toBe(false)
            expect(handleDeepLink).toHaveBeenCalledWith(url, false, 'in-app')
            expect(onExternalNavigation).not.toHaveBeenCalled()
        })

        it('loads a top-frame blob: URL in place instead of handing it to the in-app browser', () => {
            // A blob URL only resolves inside the page context that created
            // it, so a handoff to a fresh browser sheet could never load it.
            const onExternalNavigation = vi.fn()
            const { result } = renderWithHandoff(onExternalNavigation)

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('blob:https://vestige.fi/9a41c2d7-4f38'),
                ),
            ).toBe(true)
            expect(onExternalNavigation).not.toHaveBeenCalled()
        })
    })

    describe('blob: navigations (Vestige charts)', () => {
        it('allows a blob:https iframe navigation to load in place', () => {
            // Vestige's Discover charts render in iframes whose src is
            // blob:https://vestige.fi/...; refusing them blanks the chart.
            const { result } = renderGuard(true)

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('blob:https://vestige.fi/9a41c2d7-4f38', false),
                ),
            ).toBe(true)
            expect(handleDeepLink).not.toHaveBeenCalled()
        })

        it('still refuses a blob: URL not backed by http(s)', () => {
            const { result } = renderGuard(true)

            expect(
                result.current.onShouldStartLoadWithRequest(
                    request('blob:null/9a41c2d7-4f38', false),
                ),
            ).toBe(false)
            expect(Linking.openURL).not.toHaveBeenCalled()
        })
    })
})
