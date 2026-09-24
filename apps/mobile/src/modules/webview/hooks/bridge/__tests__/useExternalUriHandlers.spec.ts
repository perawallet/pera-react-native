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
import { Linking } from 'react-native'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { useExternalUriHandlers } from '../useExternalUriHandlers'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    injectedScript,
    languageMockValue,
} from './fixtures'

vi.mock('react-native', () => ({
    Linking: {
        canOpenURL: vi.fn(),
        openURL: vi.fn(),
    },
}))

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => languageMockValue(),
}))

const mockHandleDeepLink = vi.fn()
vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({ handleDeepLink: mockHandleDeepLink }),
}))

vi.mock('@hooks/deeplink/parser', () => ({
    parseDeeplink: vi.fn(() => null),
}))

const flushPromises = () =>
    act(async () => {
        await Promise.resolve()
        await Promise.resolve()
    })

describe('useExternalUriHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(Linking.canOpenURL).mockResolvedValue(true)
        vi.mocked(Linking.openURL).mockResolvedValue(true)
    })

    const render = () => {
        const webview = createMockWebview()
        const { result } = renderHook(() => useExternalUriHandlers(webview))
        return { webview, handlers: result.current }
    }

    describe('openSystemBrowser', () => {
        it('opens a supported https URL in the system browser', async () => {
            const { handlers } = render()

            handlers.openSystemBrowser(
                bridgeMessage('1', 'openSystemBrowser', {
                    url: 'https://example.com',
                }),
                TRUSTED,
            )
            await flushPromises()

            expect(Linking.canOpenURL).toHaveBeenCalledWith(
                'https://example.com',
            )
            expect(Linking.openURL).toHaveBeenCalledWith('https://example.com')
        })

        it('answers InvalidParams when the OS cannot open the URL', async () => {
            vi.mocked(Linking.canOpenURL).mockResolvedValue(false)
            const { webview, handlers } = render()

            handlers.openSystemBrowser(
                bridgeMessage('2', 'openSystemBrowser', {
                    url: 'https://example.com',
                }),
                TRUSTED,
            )
            await flushPromises()

            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"2"')
            expect(sent).toContain(
                '"error":{"code":-32602,"message":"Unsupported URL: https://example.com"}',
            )
            expect(Linking.openURL).not.toHaveBeenCalled()
        })

        it('normalizes a bare domain to https', () => {
            const { handlers } = render()

            handlers.openSystemBrowser(
                bridgeMessage('osb-bare', 'openSystemBrowser', {
                    url: 'perawallet.app',
                }),
                TRUSTED,
            )

            expect(Linking.canOpenURL).toHaveBeenCalledWith(
                'https://perawallet.app',
            )
        })

        const unsafeUrls: Array<[string, unknown]> = [
            ['data:', 'data:text/html,<script>x</script>'],
            ['file:', 'file:///etc/passwd'],
            ['javascript:', 'javascript:alert(1)'],
            ['blob:', 'blob:https://example.com/uuid'],
            ['scheme-relative', '//evil.com/page'],
            ['a non-string', 123],
        ]

        it.each(unsafeUrls)(
            'rejects %s URL before consulting Linking',
            (_label, url) => {
                const { webview, handlers } = render()

                expect(() =>
                    handlers.openSystemBrowser(
                        bridgeMessage('scheme-osb', 'openSystemBrowser', {
                            url,
                        }),
                        TRUSTED,
                    ),
                ).not.toThrow()

                expect(Linking.canOpenURL).not.toHaveBeenCalled()
                expect(Linking.openURL).not.toHaveBeenCalled()
                const sent = injectedScript(webview)
                expect(sent).toContain('"code":-32602')
                expect(sent).toContain(`Unsupported URL: ${String(url)}`)
            },
        )

        it('answers InvalidParams when the url is missing', () => {
            const { webview, handlers } = render()

            handlers.openSystemBrowser(
                bridgeMessage('19', 'openSystemBrowser'),
                TRUSTED,
            )

            expect(injectedScript(webview)).toContain('"code":-32602')
            expect(Linking.canOpenURL).not.toHaveBeenCalled()
        })
    })

    describe('canOpenURI', () => {
        it('reports whether the OS can open the URI', async () => {
            const { webview, handlers } = render()

            handlers.canOpenURI(
                bridgeMessage('3', 'canOpenURI', { uri: 'custom://uri' }),
                TRUSTED,
            )
            await flushPromises()

            expect(Linking.canOpenURL).toHaveBeenCalledWith('custom://uri')
            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"3"')
            expect(sent).toContain('"result":{"supported":true}')
        })

        it('answers InvalidParams when the uri is missing', () => {
            const { webview, handlers } = render()

            handlers.canOpenURI(bridgeMessage('20', 'canOpenURI'), TRUSTED)

            expect(injectedScript(webview)).toContain('"code":-32602')
        })
    })

    describe('openNativeURI', () => {
        it('opens a non-Pera URI through the OS', async () => {
            const { handlers } = render()

            handlers.openNativeURI(
                bridgeMessage('4', 'openNativeURI', { uri: 'custom://uri' }),
                TRUSTED,
            )
            await flushPromises()

            expect(Linking.openURL).toHaveBeenCalledWith('custom://uri')
        })

        it('routes a Pera deeplink through the dispatcher with the in-app source', () => {
            vi.mocked(parseDeeplink).mockReturnValueOnce({
                type: 'HOME',
                sourceUrl: 'perawallet://app/home',
            } as ReturnType<typeof parseDeeplink>)
            const { handlers } = render()

            handlers.openNativeURI(
                bridgeMessage('4', 'openNativeURI', {
                    uri: 'perawallet://app/home',
                }),
                TRUSTED,
            )

            expect(mockHandleDeepLink).toHaveBeenCalledWith(
                'perawallet://app/home',
                false,
                'in-app',
            )
            expect(Linking.canOpenURL).not.toHaveBeenCalled()
        })

        it('answers InvalidParams when the OS lookup fails', async () => {
            vi.mocked(Linking.canOpenURL).mockRejectedValue(new Error('nope'))
            const { webview, handlers } = render()

            handlers.openNativeURI(
                bridgeMessage('4-fail', 'openNativeURI', {
                    uri: 'custom://uri',
                }),
                TRUSTED,
            )
            await flushPromises()

            expect(injectedScript(webview)).toContain(
                '"error":{"code":-32602,"message":"Unsupported URL: custom://uri"}',
            )
        })

        it('answers InvalidParams when the uri is missing', () => {
            const { webview, handlers } = render()

            handlers.openNativeURI(
                bridgeMessage('21', 'openNativeURI'),
                TRUSTED,
            )

            expect(injectedScript(webview)).toContain('"code":-32602')
        })
    })
})
