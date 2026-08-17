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

import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
    type Mock,
} from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePeraWebviewInterface } from '../usePeraWebviewInterface'
import { resetPairingStateForTesting } from '@modules/walletconnect/hooks/useWalletConnectPairing'
import { useReturnToDappStore } from '@modules/walletconnect/stores/useReturnToDappStore'
import { useWebView } from '..'
import { Linking } from 'react-native'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import { useDeepLink } from '@hooks/useDeepLink'
import { parseDeeplink } from '@hooks/deeplink/parser'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { trackEvent } from '@analytics'

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

vi.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
        select: vi.fn(obj => obj.ios || obj.default),
    },
    Linking: {
        canOpenURL: vi.fn().mockResolvedValue(true),
        openURL: vi.fn().mockResolvedValue(true),
    },
    useColorScheme: vi.fn(() => 'light'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    View: ({ children }: any) => children,
}))

vi.mock('react-native-notifier', () => ({
    Notifier: {
        showNotification: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: {
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    generateOrderedUniqueId: vi.fn(() => 'test-id'),
    decodeFromBase64: vi.fn(t => t),
    encodeToBase64: vi.fn(t => t),
    AppError: class AppError extends Error {},
    // The `@modules/network` barrel transitively pulls store modules that
    // self-register for reset-on-logout.
    registerStore: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: vi.fn(() => ({
        deviceInfo: {
            getAppName: vi.fn(() => 'Pera Wallet'),
            getAppPackage: vi.fn(() => 'com.algorand.perarn'),
            getAppVersion: vi.fn(() => '1.0.0'),
            getDevicePlatform: vi.fn(() => 'ios'),
            getDeviceOSVersion: vi.fn(() => '17.4'),
            getDeviceModel: vi.fn(() => 'iPhone'),
            getDeviceCountry: vi.fn(() => 'US'),
            getDeviceLocale: vi.fn(() => 'en-US'),
        },
        analytics: {
            logEvent: vi.fn(),
        },
    })),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: vi.fn(() => 'device-id'),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(() => ({
        network: 'mainnet',
    })),
    useTransactionEncoder: vi.fn(() => ({
        decodeTransactions: vi.fn(txns => txns),
        encodeSignedTransaction: vi.fn(t => t),
    })),
    isValidAlgorandAddress: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    AccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
        quantum: 'quantum',
    },
    isHDWalletAccount: vi.fn(account => account.type === 'hdWallet'),
    isRekeyedAccount: vi.fn(() => false),
    canSignWith: vi.fn(() => true),
    canSignArbitraryData: vi.fn(() => true),
    useSigningAccounts: vi.fn(() => [
        {
            address: 'addr1',
            name: 'Account 1',
            type: 'hdWallet',
            hdWalletDetails: { hdWalletAddress: 'addr1' },
        },
    ]),
    useAllAccounts: vi.fn(() => [
        {
            address: 'addr1',
            name: 'Account 1',
            type: 'hdWallet',
            hdWalletDetails: { hdWalletAddress: 'addr1' },
        },
    ]),
    useSelectedAccountAddress: vi.fn(() => ({
        setSelectedAccountAddress: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: vi.fn(() => ({
        theme: 'light',
    })),
}))

vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        preferredCurrency: 'USD',
    })),
}))

const mockAddSignRequest = vi.fn()
// Thin stub for useArc0001Resolver — for each entry, treats every txn as
// signable (no signers:[] handling), so tests can keep using `[{}]`-style
// stub transactions without going through real msgpack decode.
const fakeArc0001Resolve = (request: {
    transactions: Array<Record<string, unknown>>
}) => {
    const allDecoded = request.transactions.map((_, i) => ({
        sender: { toString: () => `addr${i}` },
    }))
    const toSign = request.transactions.map((entry, i) => ({
        index: i,
        walletTxn: entry,
        decoded: allDecoded[i],
        sender: `addr${i}`,
        signer: { kind: 'single' as const, address: `addr${i}` },
    }))
    return { allDecoded, toSign, signerOverrides: new Map() }
}
// Stub for useEnqueueArc0001SignRequest — mirrors the real hook's
// short-circuit + addSignRequest behaviour so the existing assertions on
// `mockAddSignRequest` keep working.
/* eslint-disable @typescript-eslint/no-explicit-any */
const fakeEnqueue = (resolved: any, transport: any) => {
    const totalLength = resolved.allDecoded.length
    if (resolved.toSign.length === 0) {
        transport.respondWithResult(new Array(totalLength).fill(null))
        return
    }
    const indicesToSign = resolved.toSign.map((t: any) => t.index)
    const signRequest = {
        id: 'test-id',
        type: 'transactions',
        transport: 'callback',
        sourceType: transport.sourceType,
        transportId: transport.transportId,
        sourceMetadata: transport.sourceMetadata,
        txs: resolved.toSign.map((t: any) => t.decoded),
        groupContext: resolved.allDecoded,
        rawTransactionsBase64: resolved.toSign.map((t: any) => t.walletTxn.txn),
        signerOverrides:
            resolved.signerOverrides.size > 0
                ? resolved.signerOverrides
                : undefined,
        approve: async (signed: Array<unknown>) => {
            const result: Array<unknown> = new Array(totalLength).fill(null)
            signed.forEach((tx, i) => {
                if (tx) result[indicesToSign[i]] = tx
            })
            transport.respondWithResult(result)
        },
        reject: async () => transport.respondWithReject(),
        error: async (err: Error) => transport.respondWithError(err),
    }
    mockAddSignRequest(signRequest)
}
/* eslint-enable @typescript-eslint/no-explicit-any */
vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
    useArc0001Resolver: () => fakeArc0001Resolve,
    useEnqueueArc0001SignRequest: () => fakeEnqueue,
    // Mirrors the real discriminator (arc60-wire.ts) so the legacy
    // arbitrary-data payloads in this file route to the legacy branch. The
    // real module can't be imported here — the signing barrel pulls in MMKV.
    isArc60WirePayload: (params: unknown) => {
        if (
            params == null ||
            typeof params !== 'object' ||
            Array.isArray(params)
        ) {
            return false
        }
        const candidate = params as {
            authenticatorData?: unknown
            metadata?: { scope?: unknown }
        }
        return (
            candidate.authenticatorData != null ||
            candidate.metadata?.scope != null
        )
    },
    parseArc60WireRequest: vi.fn(() => {
        throw new Error(
            'parseArc60WireRequest not mocked — no test in this file exercises the ARC-60 branch',
        )
    }),
}))

const mockConnect = vi.fn(() => Promise.resolve('pairing-client'))
const mockWaitForSessionOutcome = vi.fn(async () => ({ type: 'session' }))
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({ connect: mockConnect }),
    waitForSessionOutcome: (...args: unknown[]) =>
        mockWaitForSessionOutcome(...(args as [])),
    // Real value from packages/walletconnect/src/constants.ts.
    WC_SESSION_OUTCOME_TIMEOUT_MS: 8000,
}))

vi.mock('uuid', () => ({
    v7: vi.fn(() => 'test-id'),
}))

vi.mock('@rneui/themed', () => ({
    makeStyles: () => () => ({}),
}))

vi.mock('@hooks/useIsDarkMode', () => ({
    useIsDarkMode: vi.fn(() => false),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({
        showToast: vi.fn(),
    })),
}))

// Stubbed rather than exercised: the real hook pulls resolveErrorCopy, whose
// TITLE_KEY_BY_CATEGORY needs the ErrorCategory enum this file's shared mock
// does not provide. Copy resolution is covered by resolveErrorCopy.spec.ts.
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: vi.fn(() => ({
        showError: vi.fn(),
    })),
}))

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: vi.fn(() => ({
        handleDeepLink: vi.fn(),
    })),
}))

vi.mock('@hooks/deeplink/parser', () => ({
    parseDeeplink: vi.fn(() => null),
}))

vi.mock('@hooks/deeplink/walletconnect-parser', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@hooks/deeplink/walletconnect-parser')
        >()
    return {
        walletConnectLogContext: actual.walletConnectLogContext,
        parseWalletConnectUri: vi.fn((uri: string) =>
            uri.startsWith('wc:') || uri.startsWith('perawallet-wc:')
                ? {
                      type: 'WALLET_CONNECT',
                      sourceUrl: uri,
                      uri: uri.replace('perawallet-wc:', 'wc:'),
                  }
                : null,
        ),
    }
})

const { mockUseLanguage } = vi.hoisted(() => ({
    mockUseLanguage: vi.fn(),
}))

// `currentLanguage` is left undefined by default so the existing expectations
// keep exercising the en-US fallback; the locale-specific cases set it.
vi.mock('@hooks/useLanguage', () => ({
    useLanguage: mockUseLanguage,
}))

const languageMockValue = (currentLanguage?: string) => ({
    t: (key: string, params?: Record<string, string>) => {
        if (key === 'errors.webview.unsupported_url' && params?.url) {
            return `Unsupported URL: ${params.url}`
        }
        return key
    },
    currentLanguage,
    changeLanguage: vi.fn(),
})

mockUseLanguage.mockImplementation(() => languageMockValue())

const mockPushWebView = vi.fn()
vi.mock('@modules/webview/hooks', () => ({
    useWebViewStore: vi.fn((selector?: (state: unknown) => unknown) => {
        const state = { pushWebView: mockPushWebView }
        return selector ? selector(state) : state
    }),
    useWebView: vi.fn(() => ({ pushWebView: mockPushWebView })),
}))
vi.mock('../useWebViewStore', () => ({
    useWebViewStore: vi.fn((selector?: (state: unknown) => unknown) => {
        const state = { pushWebView: mockPushWebView }
        return selector ? selector(state) : state
    }),
    useWebView: vi.fn(() => ({ pushWebView: mockPushWebView })),
    useWebViewStack: vi.fn(),
}))

describe('useWebView', () => {
    it('should provide pushWebView from store', () => {
        const { result } = renderHook(() => useWebView())
        expect(result.current.pushWebView).toBeDefined()
        expect(typeof result.current.pushWebView).toBe('function')
    })
})

describe('usePeraWebviewInterface', () => {
    const mockWebview = {
        injectJavaScript: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    beforeEach(async () => {
        vi.clearAllMocks()
        ;(Linking.canOpenURL as Mock).mockResolvedValue(true)
        ;(Linking.openURL as Mock).mockResolvedValue(true)
        ;(useDeviceID as Mock).mockReturnValue('device-id')
        // The getAddresses-parity tests swap the account hooks with bare
        // mockReturnValue calls, which survive clearAllMocks — restore the
        // factory implementations so later tests see the default account.
        const accounts = await import('@perawallet/wallet-core-accounts')
        const defaultAccounts = [
            {
                address: 'addr1',
                name: 'Account 1',
                type: 'hdWallet',
                hdWalletDetails: { hdWalletAddress: 'addr1' },
            },
        ] as unknown as ReturnType<typeof accounts.useAllAccounts>
        vi.mocked(accounts.useAllAccounts).mockImplementation(
            () => defaultAccounts,
        )
        vi.mocked(accounts.useSigningAccounts).mockImplementation(
            () => defaultAccounts,
        )
        vi.mocked(accounts.canSignWith).mockImplementation(() => true)
    })

    it('should handle openSystemBrowser action', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: '1',
                jsonrpc: '2.0',
                method: 'openSystemBrowser',
                params: { url: 'https://example.com' },
            })
        })

        expect(Linking.canOpenURL).toHaveBeenCalledWith('https://example.com')
        await act(async () => {
            await Promise.resolve()
        })
        expect(Linking.openURL).toHaveBeenCalledWith('https://example.com')
    })

    it('should handle openSystemBrowser action failure', async () => {
        ;(Linking.canOpenURL as Mock).mockResolvedValue(false)
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: '2',
                jsonrpc: '2.0',
                method: 'openSystemBrowser',
                params: { url: 'https://example.com' },
            })
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"2"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining(
                '"error":{"code":-32602,"message":"Unsupported URL: https://example.com"}',
            ),
        )
    })

    it('rejects a non-http(s) scheme for openSystemBrowser without consulting Linking.canOpenURL', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: 'osb-js-scheme',
                jsonrpc: '2.0',
                method: 'openSystemBrowser',
                params: { url: 'javascript:alert(1)' },
            })
        })

        expect(Linking.canOpenURL).not.toHaveBeenCalled()
        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"osb-js-scheme"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining(
                '"error":{"code":-32602,"message":"Unsupported URL: javascript:alert(1)"}',
            ),
        )
    })

    it('rejects a non-string url for openSystemBrowser without throwing', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            expect(() =>
                result.current.handleMessage({
                    id: 'osb-non-string',
                    jsonrpc: '2.0',
                    method: 'openSystemBrowser',
                    params: { url: 123 },
                }),
            ).not.toThrow()
        })

        expect(Linking.canOpenURL).not.toHaveBeenCalled()
        expect(Linking.openURL).not.toHaveBeenCalled()
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"osb-non-string"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining(
                '"error":{"code":-32602,"message":"Unsupported URL: 123"}',
            ),
        )
    })

    it('should handle canOpenURI action', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: '3',
                jsonrpc: '2.0',
                method: 'canOpenURI',
                params: { uri: 'custom://uri' },
            })
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(Linking.canOpenURL).toHaveBeenCalledWith('custom://uri')
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"3"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"result":{"supported":true}'),
        )
    })

    it('pushWebView omits favorite when isFavorite is absent', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: 'pw-1',
                jsonrpc: '2.0',
                method: 'pushWebView',
                params: { url: 'https://dapp.example' },
            })
        })

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://dapp.example',
                favorite: undefined,
            }),
        )
    })

    it('pushWebView seeds favorite and toggles via the source webview', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: 'pw-2',
                jsonrpc: '2.0',
                method: 'pushWebView',
                params: {
                    url: 'https://dapp.example',
                    title: 'Example Dapp',
                    isFavorite: true,
                },
            })
        })

        const pushed = mockPushWebView.mock.calls.at(-1)?.[0]
        expect(pushed.favorite.initialIsFavorite).toBe(true)

        mockWebview.injectJavaScript.mockClear()
        act(() => pushed.favorite.onToggle())

        const injected = mockWebview.injectJavaScript.mock.calls[0][0] as string
        const eventData = JSON.parse(
            injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
        )
        expect(JSON.parse(eventData)).toEqual({
            action: 'handleBrowserFavoriteButtonClick',
            payload: {
                name: 'Example Dapp',
                url: 'https://dapp.example',
                logo: null,
            },
        })
    })

    it('pushWebView normalizes a bare domain to https before the safety gate', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: 'pw-bare-domain',
                jsonrpc: '2.0',
                method: 'pushWebView',
                params: { url: 'perawallet.app' },
            })
        })

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://perawallet.app' }),
        )
        expect(mockWebview.injectJavaScript).not.toHaveBeenCalledWith(
            expect.stringContaining('"error"'),
        )
    })

    it('pushWebView passes the normalized url to the favorite toggle payload', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: 'pw-bare-favorite',
                jsonrpc: '2.0',
                method: 'pushWebView',
                params: {
                    url: 'perawallet.app',
                    title: 'Pera',
                    isFavorite: false,
                },
            })
        })

        const pushed = mockPushWebView.mock.calls.at(-1)?.[0]
        mockWebview.injectJavaScript.mockClear()
        act(() => pushed.favorite.onToggle())

        const injected = mockWebview.injectJavaScript.mock.calls[0][0] as string
        const eventData = JSON.parse(
            injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
        )
        expect(JSON.parse(eventData)).toEqual({
            action: 'handleBrowserFavoriteButtonClick',
            payload: {
                name: 'Pera',
                url: 'https://perawallet.app',
                logo: null,
            },
        })
    })

    it('pushWebView still rejects http URLs after normalization', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: 'pw-http',
                jsonrpc: '2.0',
                method: 'pushWebView',
                params: { url: 'http://example.com' },
            })
        })

        expect(mockPushWebView).not.toHaveBeenCalled()
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('Unsupported URL: http://example.com'),
        )
    })

    it('openSystemBrowser normalizes a bare domain to https', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: 'osb-bare-domain',
                jsonrpc: '2.0',
                method: 'openSystemBrowser',
                params: { url: 'perawallet.app' },
            })
        })

        expect(Linking.canOpenURL).toHaveBeenCalledWith(
            'https://perawallet.app',
        )
    })

    it('should handle openNativeURI action', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: '4',
                jsonrpc: '2.0',
                method: 'openNativeURI',
                params: { uri: 'custom://uri' },
            })
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(Linking.openURL).toHaveBeenCalledWith('custom://uri')
    })

    it('routes an openNativeURI Pera deeplink through the dispatcher with the in-app source', async () => {
        const handleDeepLink = vi.fn()
        vi.mocked(useDeepLink).mockReturnValue({
            handleDeepLink,
        } as unknown as ReturnType<typeof useDeepLink>)
        vi.mocked(parseDeeplink).mockReturnValueOnce({
            type: 'HOME',
            sourceUrl: 'perawallet://app/home',
        } as ReturnType<typeof parseDeeplink>)

        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: '4',
                jsonrpc: '2.0',
                method: 'openNativeURI',
                params: { uri: 'perawallet://app/home' },
            })
        })

        expect(handleDeepLink).toHaveBeenCalledWith(
            'perawallet://app/home',
            false,
            'in-app',
        )
        expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it('should handle getSettings action', () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: '5',
                jsonrpc: '2.0',
                method: 'getSettings',
                params: {},
            })
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"5"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"appName":"Pera Wallet"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"appPackageName":"com.algorand.perarn"'),
        )
        // deviceOSVersion must be the OS version, not the platform — the SDK
        // Settings contract keeps clientType and deviceOSVersion distinct.
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"deviceOSVersion":"17.4"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"clientType":"ios"'),
        )
        // protocolVersion is the bridge's negotiation signal — see
        // docs/DISCOVER_BRIDGE_CONTRACT.md.
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"protocolVersion":"3"'),
        )
    })

    it('returns the device id to the Discover web app for getDeviceId action', () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: 'gd-1',
                jsonrpc: '2.0',
                method: 'getDeviceId',
                params: {},
            })
        })

        const injected = mockWebview.injectJavaScript.mock.calls.at(
            -1,
        )?.[0] as string
        const eventData = JSON.parse(
            injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
        )
        expect(JSON.parse(eventData)).toEqual({
            action: 'getDeviceId',
            payload: 'device-id',
        })
    })

    it('pushes the migrated device id to the Discover web app when it lands after mount', () => {
        ;(useDeviceID as Mock).mockReturnValue(null)
        const { rerender } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )
        // No push on mount while the id is unavailable.
        expect(mockWebview.injectJavaScript).not.toHaveBeenCalled()

        ;(useDeviceID as Mock).mockReturnValue('device-id')
        act(() => {
            rerender()
        })

        const injected = mockWebview.injectJavaScript.mock.calls.at(
            -1,
        )?.[0] as string
        const eventData = JSON.parse(
            injected.replace(/^window\.postMessage\(/, '').replace(/\);$/, ''),
        )
        expect(JSON.parse(eventData)).toEqual({
            action: 'getDeviceId',
            payload: 'device-id',
        })
    })

    it('does not push the device id on the initial mount when already present', () => {
        ;(useDeviceID as Mock).mockReturnValue('device-id')
        renderHook(() => usePeraWebviewInterface(mockWebview, true, null))
        expect(mockWebview.injectJavaScript).not.toHaveBeenCalled()
    })

    it('does not push the device id when the connection is insecure', () => {
        ;(useDeviceID as Mock).mockReturnValue(null)
        const { rerender } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, false, 'https://evil.com/'),
        )
        ;(useDeviceID as Mock).mockReturnValue('device-id')
        act(() => {
            rerender()
        })
        const pushed = mockWebview.injectJavaScript.mock.calls.some(
            ([js]: [string]) => js.includes('getDeviceId'),
        )
        expect(pushed).toBe(false)
    })

    it('does not push the device id while it remains unavailable', () => {
        ;(useDeviceID as Mock).mockReturnValue(null)
        const { rerender } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )
        act(() => {
            rerender()
        })
        expect(mockWebview.injectJavaScript).not.toHaveBeenCalled()
    })

    it('should handle getPublicSettings action', () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: '6',
                jsonrpc: '2.0',
                method: 'getPublicSettings',
                params: {},
            })
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"6"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"theme":"light"'),
        )
    })

    it('reports the app locale to getPublicSettings, not a hardcoded en-US', () => {
        // Regression guard: this handler shipped `language: 'en-US'` hardcoded,
        // so Discover stayed English no matter what the user picked.
        mockUseLanguage.mockImplementation(() => languageMockValue('tr'))

        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: 'lang-1',
                jsonrpc: '2.0',
                method: 'getPublicSettings',
                params: {},
            })
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"language":"tr"'),
        )
    })

    it('reports the app locale to getSettings rather than the device locale', () => {
        // deviceInfo.getDeviceLocale() is mocked to en-US; the in-app choice is
        // pt-BR. Before this fix getSettings echoed the device, so an English
        // phone with a Portuguese app sent en-US.
        mockUseLanguage.mockImplementation(() => languageMockValue('pt-BR'))

        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: 'lang-2',
                jsonrpc: '2.0',
                method: 'getSettings',
                params: {},
            })
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"language":"pt-BR"'),
        )
    })

    it('still reports region from the device, which the language picker does not change', () => {
        mockUseLanguage.mockImplementation(() => languageMockValue('tr'))

        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: 'lang-3',
                jsonrpc: '2.0',
                method: 'getSettings',
                params: {},
            })
        })

        const sent = (
            mockWebview.injectJavaScript as ReturnType<typeof vi.fn>
        ).mock.calls
            .map(call => String(call[0]))
            .join('')
        expect(sent).toContain('"language":"tr"')
        expect(sent).toContain('"region"')
        expect(sent).not.toContain('"region":"tr"')
    })

    it('falls back to en-US when i18next has not resolved a locale yet', () => {
        // getPublicSettings is reachable before bootstrap has called
        // changeLanguage, so an empty language must not reach the web app.
        mockUseLanguage.mockImplementation(() => languageMockValue(undefined))

        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: 'lang-4',
                jsonrpc: '2.0',
                method: 'getPublicSettings',
                params: {},
            })
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"language":"en-US"'),
        )
    })

    it('should handle logAnalyticsEvent action', () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: '7',
                jsonrpc: '2.0',
                method: 'logAnalyticsEvent',
                params: { name: 'test_event', payload: { foo: 'bar' } },
            })
        })

        // Analytics mock is in the file
    })

    it('should handle closeWebView action', () => {
        const mockOnClose = vi.fn()
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null, mockOnClose),
        )

        act(() => {
            result.current.handleMessage({
                id: '8',
                jsonrpc: '2.0',
                method: 'closeWebView',
                params: {},
            })
        })

        expect(mockOnClose).toHaveBeenCalled()
    })

    it('should handle notifyUser action', () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: '9',
                jsonrpc: '2.0',
                method: 'notifyUser',
                params: { type: 'message', message: 'test message' },
            })
        })

        // Success case
    })

    it('should handle getAddresses action', () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: '10',
                jsonrpc: '2.0',
                method: 'getAddresses',
                params: {},
            })
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"10"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"address":"addr1"'),
        )
    })

    describe('getAddresses payload (Android parity)', () => {
        // useSigningAccounts owns the Watch/Unsignable filtering — the bridge
        // just maps. These tests pin the mapping (name fallback, order
        // preservation) and assume the filter behavior is covered by the
        // package's own tests.
        const setupAccountsMock = async (config: {
            accounts: Array<{
                address: string
                name?: string
                type: string
                rekeyAddress?: string
            }>
            signableAddresses?: Set<string>
            signers?: Set<string>
        }) => {
            const accounts = await import('@perawallet/wallet-core-accounts')
            const signers = config.signers ?? new Set(config.signableAddresses)
            vi.mocked(accounts.useSigningAccounts).mockReturnValue(
                config.accounts.filter(a =>
                    signers.has(a.address),
                ) as unknown as ReturnType<typeof accounts.useSigningAccounts>,
            )
            vi.mocked(accounts.useAllAccounts).mockReturnValue(
                config.accounts as unknown as ReturnType<
                    typeof accounts.useAllAccounts
                >,
            )
            vi.mocked(accounts.canSignWith).mockImplementation(
                (account: unknown) => {
                    const a = account as { address: string }
                    return signers.has(a.address)
                },
            )
        }

        const getPayload = (): Array<{
            name: string
            address: string
            type: string
        }> => {
            const calls = mockWebview.injectJavaScript.mock.calls as Array<
                [string]
            >
            const last = calls[calls.length - 1][0]
            const match = last.match(/"result":(\[[^\]]*\])/)
            if (!match) {
                throw new Error(`No result payload in: ${last}`)
            }
            return JSON.parse(match[1])
        }

        it('drops non-signing accounts (Watch, Unsignable)', async () => {
            await setupAccountsMock({
                accounts: [
                    { address: 'signer', name: 'Signer', type: 'hdWallet' },
                    { address: 'watch', name: 'Watch', type: 'watch' },
                    {
                        address: 'unsignable',
                        name: 'Unsignable',
                        type: 'watch',
                    },
                ],
                signers: new Set(['signer']),
            })

            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'ga-filter',
                    jsonrpc: '2.0',
                    method: 'getAddresses',
                    params: {},
                })
            })

            const payload = getPayload()
            expect(payload).toHaveLength(1)
            expect(payload[0].address).toBe('signer')
        })

        it('preserves store order — ordering is the consumer-side concern', async () => {
            await setupAccountsMock({
                accounts: [
                    { address: 'first', name: 'First', type: 'hdWallet' },
                    { address: 'second', name: 'Second', type: 'hdWallet' },
                    { address: 'third', name: 'Third', type: 'hdWallet' },
                ],
                signers: new Set(['first', 'second', 'third']),
            })

            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'ga-order',
                    jsonrpc: '2.0',
                    method: 'getAddresses',
                    params: {},
                })
            })

            const payload = getPayload()
            expect(payload.map(p => p.address)).toEqual([
                'first',
                'second',
                'third',
            ])
        })

        it('reports quantum accounts as their own Quantum type', async () => {
            // PQ-006 shipped quantum signing routing, so the bridge must no
            // longer tell dApps a quantum account is unsignable — but it must
            // not claim `Algo25` either: a quantum account produces a ~1.2 KB
            // Falcon signature with no recoverable Ed25519 public key.
            await setupAccountsMock({
                accounts: [
                    {
                        address: 'quantum-addr',
                        name: 'Quantum',
                        type: 'quantum',
                    },
                ],
                signers: new Set(['quantum-addr']),
            })

            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'ga-quantum',
                    jsonrpc: '2.0',
                    method: 'getAddresses',
                    params: {},
                })
            })

            const payload = getPayload()
            expect(payload).toHaveLength(1)
            expect(payload[0].type).toBe('Quantum')
        })

        it('sends empty name string when account has no name', async () => {
            await setupAccountsMock({
                accounts: [{ address: 'nameless', type: 'hdWallet' }],
                signers: new Set(['nameless']),
            })

            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'ga-name',
                    jsonrpc: '2.0',
                    method: 'getAddresses',
                    params: {},
                })
            })

            const payload = getPayload()
            expect(payload).toEqual([
                { name: '', address: 'nameless', type: 'HDWallet' },
            ])
        })
    })

    it('should handle onBackPressed action', () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: '11',
                jsonrpc: '2.0',
                method: 'onBackPressed',
                params: {},
            })
        })

        // Success case
    })

    it('should handle pushWebView action', () => {
        mockPushWebView.mockClear()

        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        act(() => {
            result.current.handleMessage({
                id: '12',
                jsonrpc: '2.0',
                method: 'pushWebView',
                params: { url: 'https://example.com' },
            })
        })

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://example.com', id: '12' }),
        )
    })

    it('should handle requestTransactionSigning action', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        const txns = [{ txn: 'BASE64_TXN' }]
        const metadata = { name: 'Test dApp' }

        await act(async () => {
            result.current.handleMessage({
                id: '13',
                jsonrpc: '2.0',
                method: 'requestTransactionSigning',
                params: { txns, metadata },
            })
        })

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'test-id',
                type: 'transactions',
                transport: 'callback',
                sourceType: 'webview',
                sourceMetadata: metadata,
                txs: expect.any(Array),
                groupContext: expect.any(Array),
                rawTransactionsBase64: ['BASE64_TXN'],
            }),
        )

        const signRequest = mockAddSignRequest.mock.calls[0][0]
        const signedTxs = [{ id: 'tx1' }]

        await act(async () => {
            await signRequest.approve(signedTxs)
        })

        // ARC-0001 response shape: an array of (base64 | null) in slot order.
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"13"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"result":[{"id":"tx1"}]'),
        )
    })

    it('should handle requestTransactionSigning error', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        const txns = [{ txn: 'BASE64_TXN' }]
        const metadata = { name: 'Test dApp' }

        await act(async () => {
            result.current.handleMessage({
                id: '13-error',
                jsonrpc: '2.0',
                method: 'requestTransactionSigning',
                params: { txns, metadata },
            })
        })

        const signRequest =
            mockAddSignRequest.mock.calls[
                mockAddSignRequest.mock.calls.length - 1
            ][0]

        await act(async () => {
            await signRequest.error(new Error('User rejected'))
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"13-error"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining(
                '"error":{"code":-32603,"message":"An error occurred during signing"}',
            ),
        )
    })

    it('should handle requestDataSigning action', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        const data = { data: 'AQID', message: 'Sign this', signer: 'addr1' }
        const metadata = { name: 'Test dApp' }

        await act(async () => {
            result.current.handleMessage({
                id: '14',
                jsonrpc: '2.0',
                method: 'requestDataSigning',
                params: { data, metadata },
            })
        })

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'test-id',
                type: 'arbitrary-data',
                transport: 'callback',
                data: [{ data: 'AQID', message: 'Sign this', signer: 'addr1' }],
                sourceMetadata: metadata,
            }),
        )

        // Test success
        const signRequest =
            mockAddSignRequest.mock.calls[
                mockAddSignRequest.mock.calls.length - 1
            ][0]
        const signature = new Uint8Array([4, 5, 6])

        await act(async () => {
            await signRequest.approve([{ signature }])
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"14"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"result":[{"0":4,"1":5,"2":6}]'),
        )
    })

    it('rejects requestDataSigning before the review sheet when the signer cannot sign arbitrary data', async () => {
        // Ledger/watch signers fail at the hardware strategy AFTER the user
        // slides to confirm — the preflight must reject before enqueueing,
        // matching the WC transport's up-front canSignArbitraryData gate.
        const accounts = await import('@perawallet/wallet-core-accounts')
        vi.mocked(accounts.canSignArbitraryData).mockReturnValueOnce(false)

        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: '14-preflight',
                jsonrpc: '2.0',
                method: 'requestDataSigning',
                params: {
                    data: { data: 'AQID', signer: 'addr1' },
                    metadata: { name: 'Test dApp' },
                },
            })
        })

        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"14-preflight"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('Signer cannot sign arbitrary data'),
        )
    })

    it('rejects requestDataSigning before the review sheet when the signer is not a wallet account', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        await act(async () => {
            result.current.handleMessage({
                id: '14-unknown-signer',
                jsonrpc: '2.0',
                method: 'requestDataSigning',
                params: {
                    data: { data: 'AQID', signer: 'not-a-wallet-address' },
                    metadata: { name: 'Test dApp' },
                },
            })
        })

        expect(mockAddSignRequest).not.toHaveBeenCalled()
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"14-unknown-signer"'),
        )
    })

    it('should handle requestDataSigning error', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        const data = { data: 'AQID', signer: 'addr1' }
        const metadata = { name: 'Test dApp' }

        await act(async () => {
            result.current.handleMessage({
                id: '14-error',
                jsonrpc: '2.0',
                method: 'requestDataSigning',
                params: { data, metadata },
            })
        })

        const signRequest =
            mockAddSignRequest.mock.calls[
                mockAddSignRequest.mock.calls.length - 1
            ][0]

        await act(async () => {
            await signRequest.error(new Error('Unauthorized'))
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"14-error"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining(
                '"error":{"code":-32603,"message":"An error occurred during signing"}',
            ),
        )
    })

    describe('per-message origin trust', () => {
        it('evaluates a message racing a navigation against the post-navigation origin, not the stale hook state', () => {
            // Hook-level state still reflects the pre-navigation trusted
            // origin A; the message event itself carries origin B.
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    true,
                    'https://discover-mobile-staging.perawallet.app/',
                ),
            )

            act(() => {
                result.current.handleMessage(
                    {
                        id: 'race-1',
                        jsonrpc: '2.0',
                        method: 'getAddresses',
                        params: {},
                    },
                    {
                        securedConnection: false,
                        sourceUrl: 'https://evil.com/',
                    },
                )
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"code":-32001'),
            )
            expect(mockWebview.injectJavaScript).not.toHaveBeenCalledWith(
                expect.stringContaining('"address":"addr1"'),
            )
        })

        it('trusts a message from the trusted origin even while hook state still says untrusted', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    false,
                    'https://evil.com/',
                ),
            )

            act(() => {
                result.current.handleMessage(
                    {
                        id: 'race-2',
                        jsonrpc: '2.0',
                        method: 'getAddresses',
                        params: {},
                    },
                    {
                        securedConnection: true,
                        sourceUrl:
                            'https://discover-mobile-staging.perawallet.app/',
                    },
                )
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"address":"addr1"'),
            )
        })

        it('falls back to the mount-level decision when no per-message security is given', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    false,
                    'https://evil.com/',
                ),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'no-security',
                    jsonrpc: '2.0',
                    method: 'getAddresses',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"code":-32001'),
            )
        })
    })

    describe('insecure connection handling', () => {
        it('should send Unauthorized error for getAddresses when connection is insecure', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    false,
                    'https://evil.com/',
                ),
            )

            act(() => {
                result.current.handleMessage({
                    id: '15',
                    jsonrpc: '2.0',
                    method: 'getAddresses',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"code":-32001'),
            )
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining(
                    '"message":"Operation not permitted from this origin"',
                ),
            )
        })

        it('should send Unauthorized error for getSettings when connection is insecure', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    false,
                    'https://evil.com/',
                ),
            )

            act(() => {
                result.current.handleMessage({
                    id: '16',
                    jsonrpc: '2.0',
                    method: 'getSettings',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"code":-32001'),
            )
        })

        it('should send Unauthorized error for getDeviceId when connection is insecure', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    false,
                    'https://evil.com/',
                ),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'gd-2',
                    jsonrpc: '2.0',
                    method: 'getDeviceId',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"code":-32001'),
            )
        })

        it('should not enqueue sign request for requestTransactionSigning when connection is insecure', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    false,
                    'https://evil.com/',
                ),
            )

            act(() => {
                result.current.handleMessage({
                    id: '17',
                    jsonrpc: '2.0',
                    method: 'requestTransactionSigning',
                    params: { txns: [], metadata: {} },
                })
            })

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"code":-32001'),
            )
        })
    })

    describe('openWalletConnect handling', () => {
        beforeEach(() => {
            mockConnect.mockClear()
            // The handshake-topic join in useWalletConnectPairing is
            // module-level; clear it so one test's pending pairing can't
            // swallow another test's connect.
            resetPairingStateForTesting()
        })

        it('rejects non-WalletConnect URIs with InvalidParams', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    true,
                    'https://discover-mobile-staging.perawallet.app/',
                ),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'wc-invalid',
                    jsonrpc: '2.0',
                    method: 'walletConnect',
                    params: { uri: 'https://evil.com' },
                })
            })

            expect(mockConnect).not.toHaveBeenCalled()
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"code":-32602'),
            )
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"Invalid WalletConnect URI"'),
            )
        })

        it('opens the approval flow (never auto-connects) for a trusted origin with a valid wc URI', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    true,
                    'https://discover-mobile-staging.perawallet.app/',
                ),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'wc-trusted',
                    jsonrpc: '2.0',
                    method: 'walletConnect',
                    params: { uri: 'wc:topic@2?relay-protocol=irn' },
                })
            })

            // No autoConnect, even on a trusted origin: the connection always
            // goes through the user-facing approval sheet.
            expect(mockConnect).toHaveBeenCalledWith({
                connection: {
                    uri: 'wc:topic@2?relay-protocol=irn',
                },
            })
        })

        it('opens the approval flow for an untrusted origin with a valid wc URI', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    false,
                    'https://evil.com/',
                ),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'wc-untrusted',
                    jsonrpc: '2.0',
                    method: 'walletConnect',
                    params: { uri: 'wc:topic@2?relay-protocol=irn' },
                })
            })

            expect(mockConnect).toHaveBeenCalledWith({
                connection: {
                    uri: 'wc:topic@2?relay-protocol=irn',
                },
            })
        })

        it('answers the page with a readable error when the pairing outcome times out', async () => {
            mockWaitForSessionOutcome.mockResolvedValueOnce({
                type: 'timeout',
            } as never)
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            await act(async () => {
                result.current.handleMessage({
                    id: 'wc-timeout',
                    jsonrpc: '2.0',
                    method: 'walletConnect',
                    params: { uri: 'wc:topic@2?relay-protocol=irn' },
                })
                await Promise.resolve()
                await Promise.resolve()
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"id":"wc-timeout"'),
            )
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('No response from the dApp'),
            )
        })

        it('relays a pairing rejection (e.g. wrong network) back to the page', async () => {
            mockWaitForSessionOutcome.mockResolvedValueOnce({
                type: 'error',
                error: new Error('wrong network'),
            } as never)
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            await act(async () => {
                result.current.handleMessage({
                    id: 'wc-rejected',
                    jsonrpc: '2.0',
                    method: 'walletConnect',
                    params: { uri: 'wc:topic@2?relay-protocol=irn' },
                })
                await Promise.resolve()
                await Promise.resolve()
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"id":"wc-rejected"'),
            )
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('wrong network'),
            )
        })

        it('logs a connect failure by topic and bridge origin, never the URI', async () => {
            mockConnect.mockRejectedValueOnce(new Error('bridge unreachable'))
            const { logger } = await import('@perawallet/wallet-core-shared')
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            await act(async () => {
                result.current.handleMessage({
                    id: 'wc-fail',
                    jsonrpc: '2.0',
                    method: 'walletConnect',
                    params: {
                        uri: 'wc:topic-1@1?bridge=https%3A%2F%2Fb.example&key=deadbeef',
                    },
                })
                await Promise.resolve()
                await Promise.resolve()
            })

            expect(logger.error).toHaveBeenCalledWith(
                '[webview/wc] connect failed',
                {
                    error: expect.any(Error),
                    topic: 'topic-1',
                    bridgeOrigin: 'https://b.example',
                },
            )
            const context = vi.mocked(logger.error).mock.calls.at(-1)?.[1]
            expect(JSON.stringify(context)).not.toContain('deadbeef')
        })

        it('short-circuits with an offline error instead of dialing a dead bridge', async () => {
            const { useNetworkStatusStore } = await import('@modules/network')
            useNetworkStatusStore.setState({ hasInternet: false })
            try {
                const { result } = renderHook(() =>
                    usePeraWebviewInterface(mockWebview, true, null),
                )

                act(() => {
                    result.current.handleMessage({
                        id: 'wc-offline',
                        jsonrpc: '2.0',
                        method: 'walletConnect',
                        params: { uri: 'wc:topic@2?relay-protocol=irn' },
                    })
                })

                expect(mockConnect).not.toHaveBeenCalled()
                expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                    expect.stringContaining('"id":"wc-offline"'),
                )
                expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                    expect.stringContaining('offline'),
                )
            } finally {
                useNetworkStatusStore.setState({ hasInternet: true })
            }
        })

        it('throttles a second connect inside the dedup window', () => {
            vi.useFakeTimers()
            try {
                const { result } = renderHook(() =>
                    usePeraWebviewInterface(
                        mockWebview,
                        false,
                        'https://evil.com/',
                    ),
                )

                act(() => {
                    result.current.handleMessage({
                        id: 'wc-first',
                        jsonrpc: '2.0',
                        method: 'walletConnect',
                        params: { uri: 'wc:topic@2?relay-protocol=irn' },
                    })
                })
                expect(mockConnect).toHaveBeenCalledTimes(1)

                act(() => {
                    result.current.handleMessage({
                        id: 'wc-spam',
                        jsonrpc: '2.0',
                        method: 'walletConnect',
                        params: { uri: 'wc:other@2?relay-protocol=irn' },
                    })
                })
                expect(mockConnect).toHaveBeenCalledTimes(1)
                expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                    expect.stringContaining('"id":"wc-spam"'),
                )
                expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                    expect.stringContaining('throttled'),
                )
            } finally {
                vi.useRealTimers()
            }
        })

        it('records an in-app pairing origin so post-action sheets stay suppressed', async () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            await act(async () => {
                result.current.handleMessage({
                    id: 'wc-origin',
                    jsonrpc: '2.0',
                    method: 'walletConnect',
                    params: { uri: 'wc:origin-topic@2?relay-protocol=irn' },
                })
            })

            // mockConnect resolves 'pairing-client'; the real pairing hook
            // writes the origin under that id.
            await waitFor(() => {
                expect(
                    useReturnToDappStore.getState().returnContexts[
                        'pairing-client'
                    ],
                ).toMatchObject({ origin: 'in-app' })
            })
        })

        it('accepts a connect again once the dedup window elapsed and the first pairing settled', async () => {
            vi.useFakeTimers()
            try {
                const { result } = renderHook(() =>
                    usePeraWebviewInterface(mockWebview, true, null),
                )

                act(() => {
                    result.current.handleMessage({
                        id: 'wc-first',
                        jsonrpc: '2.0',
                        method: 'walletConnect',
                        params: { uri: 'wc:topic@2?relay-protocol=irn' },
                    })
                })
                expect(mockConnect).toHaveBeenCalledTimes(1)

                // Settle the first pairing: while it is in flight, a retry
                // on the same handshake topic deliberately joins it (one
                // connector per topic) instead of building a second one.
                await act(async () => {
                    await vi.runAllTimersAsync()
                })
                vi.advanceTimersByTime(2000)

                act(() => {
                    result.current.handleMessage({
                        id: 'wc-retry',
                        jsonrpc: '2.0',
                        method: 'walletConnect',
                        params: { uri: 'wc:topic@2?relay-protocol=irn' },
                    })
                })
                expect(mockConnect).toHaveBeenCalledTimes(2)
            } finally {
                vi.useRealTimers()
            }
        })

        it('joins a retry onto the in-flight pairing for the same handshake topic', () => {
            vi.useFakeTimers()
            try {
                const { result } = renderHook(() =>
                    usePeraWebviewInterface(mockWebview, true, null),
                )

                act(() => {
                    result.current.handleMessage({
                        id: 'wc-first',
                        jsonrpc: '2.0',
                        method: 'walletConnect',
                        params: { uri: 'wc:topic@2?relay-protocol=irn' },
                    })
                })
                vi.advanceTimersByTime(2000)
                act(() => {
                    result.current.handleMessage({
                        id: 'wc-retry',
                        jsonrpc: '2.0',
                        method: 'walletConnect',
                        params: { uri: 'wc:topic@2?relay-protocol=irn' },
                    })
                })

                // One connector per topic — a second one would receive the
                // bridge-replayed session_request again and queue a
                // duplicate approval sheet.
                expect(mockConnect).toHaveBeenCalledTimes(1)
            } finally {
                vi.useRealTimers()
            }
        })
    })

    describe('URL scheme validation', () => {
        const unsafeUrls: Array<[string, string]> = [
            ['data:', 'data:text/html,<script>x</script>'],
            ['file:', 'file:///etc/passwd'],
            ['javascript:', 'javascript:alert(1)'],
            ['blob:', 'blob:https://example.com/uuid'],
            ['scheme-relative', '//evil.com/page'],
        ]

        it.each(unsafeUrls)(
            'pushWebView rejects %s URLs with InvalidParams',
            (_scheme, url) => {
                const { result } = renderHook(() =>
                    usePeraWebviewInterface(mockWebview, true, null),
                )

                act(() => {
                    result.current.handleMessage({
                        id: 'scheme-push',
                        jsonrpc: '2.0',
                        method: 'pushWebView',
                        params: { url },
                    })
                })

                expect(mockPushWebView).not.toHaveBeenCalled()
                expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                    expect.stringContaining('"code":-32602'),
                )
                expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                    expect.stringContaining(`Unsupported URL: ${url}`),
                )
            },
        )

        it.each(unsafeUrls)(
            'openSystemBrowser rejects %s URLs before Linking',
            (_scheme, url) => {
                const { result } = renderHook(() =>
                    usePeraWebviewInterface(mockWebview, true, null),
                )

                act(() => {
                    result.current.handleMessage({
                        id: 'scheme-osb',
                        jsonrpc: '2.0',
                        method: 'openSystemBrowser',
                        params: { url },
                    })
                })

                expect(Linking.canOpenURL).not.toHaveBeenCalled()
                expect(Linking.openURL).not.toHaveBeenCalled()
                expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                    expect.stringContaining('"code":-32602'),
                )
                expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                    expect.stringContaining(`Unsupported URL: ${url}`),
                )
            },
        )
    })

    describe('missing parameter validation', () => {
        it('should send error for pushWebView with missing url', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '18',
                    jsonrpc: '2.0',
                    method: 'pushWebView',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"error"'),
            )
        })

        it('should send error for openSystemBrowser with missing url', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '19',
                    jsonrpc: '2.0',
                    method: 'openSystemBrowser',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"error"'),
            )
        })

        it('should send error for canOpenURI with missing uri', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '20',
                    jsonrpc: '2.0',
                    method: 'canOpenURI',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"error"'),
            )
        })

        it('should send error for openNativeURI with missing uri', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '21',
                    jsonrpc: '2.0',
                    method: 'openNativeURI',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"error"'),
            )
        })

        it('should send error for notifyUser with missing type', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '22',
                    jsonrpc: '2.0',
                    method: 'notifyUser',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"error"'),
            )
        })

        it('should send error for requestTransactionSigning with missing params', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '23',
                    jsonrpc: '2.0',
                    method: 'requestTransactionSigning',
                    // missing metadata
                    params: { txns: [] },
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"error"'),
            )
        })

        it('should send error for requestDataSigning with missing params', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '24',
                    jsonrpc: '2.0',
                    method: 'requestDataSigning',
                    params: { data: 'AQID' }, // missing metadata and address
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"error"'),
            )
        })

        it('should send error for logAnalyticsEvent with missing params', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '25',
                    jsonrpc: '2.0',
                    method: 'logAnalyticsEvent',
                    params: { name: 'test' }, // missing payload
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"error"'),
            )
        })
    })

    describe('transaction limit handling', () => {
        it('should send error to webview when addSignRequest throws for over-limit transactions', () => {
            mockAddSignRequest.mockImplementation(() => {
                throw new Error('Transaction limit exceeded')
            })

            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '30',
                    jsonrpc: '2.0',
                    method: 'requestTransactionSigning',
                    params: {
                        txns: [{ txn: 'BASE64_TXN' }],
                        metadata: { name: 'Test' },
                    },
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"id":"30"'),
            )
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('An error occurred during signing'),
            )
        })

        it('should send error to webview when addSignRequest throws for over-limit data signing', () => {
            mockAddSignRequest.mockImplementation(() => {
                throw new Error('Data sign limit exceeded')
            })

            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '31',
                    jsonrpc: '2.0',
                    method: 'requestDataSigning',
                    params: {
                        data: {
                            data: 'AQID',
                            message: 'Sign this',
                            signer: 'addr1',
                        },
                        metadata: { name: 'Test' },
                    },
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"id":"31"'),
            )
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('An error occurred during signing'),
            )
        })
    })

    describe('unknown method handling', () => {
        it('should send error for unknown method', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: '26',
                    jsonrpc: '2.0',
                    method: 'unknownMethod',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"error"'),
            )
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"id":"26"'),
            )
        })

        it('tracks an analytics event for an unknown/legacy method and still answers MethodNotFound', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(
                    mockWebview,
                    true,
                    'https://discover-mobile.perawallet.app/',
                ),
            )

            act(() => {
                result.current.handleMessage({
                    id: '27',
                    jsonrpc: '2.0',
                    method: 'handleTokenDetailActionButtonClick',
                    params: {},
                })
            })

            expect(trackEvent).toHaveBeenCalledWith(
                'webview_bridge_method_not_found',
                {
                    webview_bridge_method: 'handleTokenDetailActionButtonClick',
                    url: 'https://discover-mobile.perawallet.app/',
                },
            )
            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"code":-32601'),
            )
        })

        it('warns loudly in dev builds for an unknown method', () => {
            ;(globalThis as { __DEV__?: boolean }).__DEV__ = true
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {})
            try {
                const { result } = renderHook(() =>
                    usePeraWebviewInterface(mockWebview, true, null),
                )

                act(() => {
                    result.current.handleMessage({
                        id: '28',
                        jsonrpc: '2.0',
                        method: 'pushTokenDetailScreen',
                        params: {},
                    })
                })

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
                const { result } = renderHook(() =>
                    usePeraWebviewInterface(mockWebview, true, null),
                )

                act(() => {
                    result.current.handleMessage({
                        id: '29',
                        jsonrpc: '2.0',
                        method: 'pushTokenDetailScreen',
                        params: {},
                    })
                })

                expect(warnSpy).not.toHaveBeenCalled()
            } finally {
                warnSpy.mockRestore()
            }
        })
    })

    describe('dark mode theme handling', () => {
        beforeEach(() => {
            vi.mocked(useIsDarkMode).mockReturnValue(true)
        })

        afterEach(() => {
            vi.mocked(useIsDarkMode).mockReturnValue(false)
        })

        it('should return dark theme in getPublicSettings when dark mode is active', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'dark-1',
                    jsonrpc: '2.0',
                    method: 'getPublicSettings',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"theme":"dark"'),
            )
        })

        it('should return dark theme in getSettings when dark mode is active', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true, null),
            )

            act(() => {
                result.current.handleMessage({
                    id: 'dark-2',
                    jsonrpc: '2.0',
                    method: 'getSettings',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
                expect.stringContaining('"theme":"dark"'),
            )
        })
    })
})
