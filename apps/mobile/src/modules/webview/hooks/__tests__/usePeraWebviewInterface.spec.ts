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

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { trackEvent } from '@analytics'
import { usePeraWebviewInterface } from '../usePeraWebviewInterface'
import {
    PERA_WEBVIEW_BRIDGE_METHODS,
    type PeraWebviewBridgeMethod,
} from '../bridge-methods'
import { useDataSigningHandler } from '../bridge/useDataSigningHandler'
import { useDeviceIdHandler } from '../bridge/useDeviceIdHandler'
import { useTransactionSigningHandler } from '../bridge/useTransactionSigningHandler'
import { useWalletConnectHandler } from '../bridge/useWalletConnectHandler'
import {
    bridgeMessage,
    createMockWebview,
    injectedScript,
    languageMockValue,
} from '../bridge/__tests__/fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    WebviewEvent: {
        BridgeMethodNotFound: 'webview_bridge_method_not_found',
    },
    AnalyticsMetadataKey: {
        WebviewBridgeMethod: 'webview_bridge_method',
        Url: 'url',
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => languageMockValue(),
}))

// One stub per bridge method; each handler's behaviour has its own spec under
// bridge/__tests__, so this file covers only dispatch and the trust gate.
const { handlers } = vi.hoisted(() => ({
    handlers: {} as Record<string, Mock>,
}))
const stub = (method: string): Mock => {
    handlers[method] ??= vi.fn()
    return handlers[method]
}

vi.mock('../bridge/usePushWebViewHandler', () => ({
    usePushWebViewHandler: () => stub('pushWebView'),
}))
vi.mock('../bridge/useExternalUriHandlers', () => ({
    useExternalUriHandlers: () => ({
        openSystemBrowser: stub('openSystemBrowser'),
        canOpenURI: stub('canOpenURI'),
        openNativeURI: stub('openNativeURI'),
    }),
}))
vi.mock('../bridge/useNotifyUserHandler', () => ({
    useNotifyUserHandler: () => stub('notifyUser'),
}))
vi.mock('../bridge/useGetAddressesHandler', () => ({
    useGetAddressesHandler: () => stub('getAddresses'),
}))
vi.mock('../bridge/useSettingsHandlers', () => ({
    useSettingsHandlers: () => ({
        getSettings: stub('getSettings'),
        getPublicSettings: stub('getPublicSettings'),
    }),
}))
vi.mock('../bridge/useDeviceIdHandler', () => ({
    useDeviceIdHandler: vi.fn(() => stub('getDeviceId')),
}))
vi.mock('../bridge/useHostNavigationHandlers', () => ({
    useHostNavigationHandlers: () => ({
        onBackPressed: stub('onBackPressed'),
        closeWebView: stub('closeWebView'),
    }),
}))
vi.mock('../bridge/useLogAnalyticsEventHandler', () => ({
    useLogAnalyticsEventHandler: () => stub('logAnalyticsEvent'),
}))
vi.mock('../bridge/useTransactionSigningHandler', () => ({
    useTransactionSigningHandler: vi.fn(() =>
        stub('requestTransactionSigning'),
    ),
}))
vi.mock('../bridge/useDataSigningHandler', () => ({
    useDataSigningHandler: vi.fn(() => stub('requestDataSigning')),
}))
vi.mock('../bridge/useWalletConnectHandler', () => ({
    useWalletConnectHandler: vi.fn(() => stub('walletConnect')),
}))

const TRUSTED_URL = 'https://discover-mobile.perawallet.app/'
const EVIL_URL = 'https://evil.com/'

// The trust posture of the whole bridge, stated once; it must match the
// `requireSecure` column of docs/WEBVIEW_ARCHITECTURE.md.
const OPEN_METHODS: PeraWebviewBridgeMethod[] = [
    'getPublicSettings',
    'onBackPressed',
    'closeWebView',
    'walletConnect',
]
const GUARDED_METHODS = PERA_WEBVIEW_BRIDGE_METHODS.filter(
    method => !OPEN_METHODS.includes(method),
)

describe('usePeraWebviewInterface', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const render = (securedConnection: boolean, sourceUrl: string | null) => {
        const webview = createMockWebview()
        const { result } = renderHook(() =>
            usePeraWebviewInterface(webview, securedConnection, sourceUrl),
        )
        return { webview, handleMessage: result.current.handleMessage }
    }

    it('wires the mount-level context into the handlers that need it', () => {
        const { webview } = render(true, TRUSTED_URL)

        expect(useDeviceIdHandler).toHaveBeenCalledWith(webview, true)
        expect(useTransactionSigningHandler).toHaveBeenCalledWith(
            webview,
            TRUSTED_URL,
        )
        expect(useDataSigningHandler).toHaveBeenCalledWith(webview, TRUSTED_URL)
        expect(useWalletConnectHandler).toHaveBeenCalledWith(
            webview,
            TRUSTED_URL,
        )
    })

    it.each([...PERA_WEBVIEW_BRIDGE_METHODS])(
        'routes a trusted %s message to its handler with the mount-level security',
        method => {
            const { handleMessage } = render(true, TRUSTED_URL)
            const message = bridgeMessage('1', method, { a: 1 })

            act(() => handleMessage(message))

            expect(handlers[method]).toHaveBeenCalledWith(message, {
                securedConnection: true,
                sourceUrl: TRUSTED_URL,
            })
            const others = PERA_WEBVIEW_BRIDGE_METHODS.filter(
                other => other !== method,
            )
            for (const other of others) {
                expect(handlers[other]).not.toHaveBeenCalled()
            }
        },
    )

    it.each(GUARDED_METHODS)(
        'answers %s from an untrusted origin with Unauthorized, never reaching the handler',
        method => {
            const { webview, handleMessage } = render(false, EVIL_URL)

            act(() => handleMessage(bridgeMessage('u-1', method)))

            expect(handlers[method]).not.toHaveBeenCalled()
            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"u-1"')
            expect(sent).toContain(
                '"error":{"code":-32001,"message":"Operation not permitted from this origin"}',
            )
        },
    )

    it.each(OPEN_METHODS)(
        'lets %s through from an untrusted origin',
        method => {
            const { webview, handleMessage } = render(false, EVIL_URL)

            act(() => handleMessage(bridgeMessage('o-1', method)))

            expect(handlers[method]).toHaveBeenCalledTimes(1)
            expect(webview.injectJavaScript).not.toHaveBeenCalled()
        },
    )

    it('dispatches every message of a batch in order', () => {
        const { handleMessage } = render(true, TRUSTED_URL)
        const order: string[] = []
        handlers.getSettings.mockImplementation(() => order.push('settings'))
        handlers.getAddresses.mockImplementation(() => order.push('addresses'))

        act(() =>
            handleMessage([
                bridgeMessage('b-1', 'getSettings'),
                bridgeMessage('b-2', 'getAddresses'),
            ]),
        )

        expect(order).toEqual(['settings', 'addresses'])
    })

    describe('per-message origin trust', () => {
        it('evaluates a message racing a navigation against the post-navigation origin, not the stale hook state', () => {
            const { webview, handleMessage } = render(true, TRUSTED_URL)

            act(() =>
                handleMessage(bridgeMessage('race-1', 'getAddresses'), {
                    securedConnection: false,
                    sourceUrl: EVIL_URL,
                }),
            )

            expect(handlers.getAddresses).not.toHaveBeenCalled()
            expect(injectedScript(webview)).toContain('"code":-32001')
        })

        it('trusts a message from the trusted origin even while hook state still says untrusted', () => {
            const { handleMessage } = render(false, EVIL_URL)
            const security = {
                securedConnection: true,
                sourceUrl: TRUSTED_URL,
            }
            const message = bridgeMessage('race-2', 'getAddresses')

            act(() => handleMessage(message, security))

            expect(handlers.getAddresses).toHaveBeenCalledWith(
                message,
                security,
            )
        })
    })

    describe('unknown method handling', () => {
        it('answers MethodNotFound and tracks the method with its source URL', () => {
            const { webview, handleMessage } = render(true, TRUSTED_URL)

            act(() =>
                handleMessage(
                    bridgeMessage('27', 'handleTokenDetailActionButtonClick'),
                ),
            )

            expect(trackEvent).toHaveBeenCalledWith(
                'webview_bridge_method_not_found',
                {
                    webview_bridge_method: 'handleTokenDetailActionButtonClick',
                    url: TRUSTED_URL,
                },
            )
            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"27"')
            expect(sent).toContain(
                '"error":{"code":-32601,"message":"errors.webview.invalid_method"}',
            )
        })

        it('omits the URL from the analytics event when the origin is unknown', () => {
            const { handleMessage } = render(true, null)

            act(() => handleMessage(bridgeMessage('26', 'unknownMethod')))

            expect(trackEvent).toHaveBeenCalledWith(
                'webview_bridge_method_not_found',
                { webview_bridge_method: 'unknownMethod' },
            )
        })

        it('warns loudly in dev builds for an unknown method', () => {
            ;(globalThis as { __DEV__?: boolean }).__DEV__ = true
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {})
            try {
                const { handleMessage } = render(true, null)

                act(() =>
                    handleMessage(bridgeMessage('28', 'pushTokenDetailScreen')),
                )

                expect(warnSpy).toHaveBeenCalledWith(
                    expect.stringContaining('pushTokenDetailScreen'),
                )
            } finally {
                warnSpy.mockRestore()
                ;(globalThis as { __DEV__?: boolean }).__DEV__ = false
            }
        })

        it('does not warn on the console in non-dev builds', () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {})
            try {
                const { handleMessage } = render(true, null)

                act(() =>
                    handleMessage(bridgeMessage('29', 'pushTokenDetailScreen')),
                )

                expect(warnSpy).not.toHaveBeenCalled()
            } finally {
                warnSpy.mockRestore()
            }
        })
    })
})
