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

import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi,
    type Mock,
} from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePeraWebviewInterface } from '../usePeraWebviewInterface'
import { useWebView } from '..'
import { Linking } from 'react-native'
import { useIsDarkMode } from '@hooks/useIsDarkMode'

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
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: vi.fn(() => ({
        deviceInfo: {
            getAppName: vi.fn(() => 'Pera Wallet'),
            getAppPackage: vi.fn(() => 'com.algorand.perarn'),
            getAppVersion: vi.fn(() => '1.0.0'),
            getDevicePlatform: vi.fn(() => 'ios'),
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

const SIGNING_LOGICAL_TYPES = new Set([
    'HdKey',
    'Algo25',
    'LedgerBle',
    'LedgerUsb',
    'Multisig',
])

vi.mock('@perawallet/wallet-core-accounts', () => ({
    isHDWalletAccount: vi.fn(account => account.type === 'standard'),
    isRekeyedAccount: vi.fn(() => false),
    isSigningLogicalType: vi.fn((type: string) =>
        SIGNING_LOGICAL_TYPES.has(type),
    ),
    useAllAccounts: vi.fn(() => [
        {
            address: 'addr1',
            name: 'Account 1',
            type: 'standard',
            hdWalletDetails: { hdWalletAddress: 'addr1' },
        },
    ]),
    useAllAccountLogicalTypes: vi.fn(() => new Map([['addr1', 'HdKey']])),
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
vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
}))

const mockConnect = vi.fn()
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({ connect: mockConnect }),
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

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: vi.fn(() => ({
        handleDeepLink: vi.fn(),
    })),
}))

vi.mock('@hooks/deeplink/parser', () => ({
    parseDeeplink: vi.fn(() => null),
}))

vi.mock('@hooks/deeplink/walletconnect-parser', () => ({
    parseWalletConnectUri: vi.fn((uri: string) =>
        uri.startsWith('wc:') || uri.startsWith('perawallet-wc:')
            ? {
                  type: 'WALLET_CONNECT',
                  sourceUrl: uri,
                  uri: uri.replace('perawallet-wc:', 'wc:'),
              }
            : null,
    ),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(() => ({
        t: (key: string, params?: Record<string, string>) => {
            if (key === 'errors.webview.unsupported_url' && params?.url) {
                return `Unsupported URL: ${params.url}`
            }
            return key
        },
    })),
}))

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

    beforeEach(() => {
        vi.clearAllMocks()
        ;(Linking.canOpenURL as Mock).mockResolvedValue(true)
        ;(Linking.openURL as Mock).mockResolvedValue(true)
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
        const setupAccountsMock = async (config: {
            accounts: Array<{ address: string; name?: string; type: string }>
            types: Map<string, string>
        }) => {
            const accounts = await import('@perawallet/wallet-core-accounts')
            vi.mocked(accounts.useAllAccounts).mockReturnValue(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                config.accounts as any,
            )
            vi.mocked(accounts.useAllAccountLogicalTypes).mockReturnValue(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                config.types as any,
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

        it('drops non-signing accounts (Watch, NoAuth)', async () => {
            await setupAccountsMock({
                accounts: [
                    { address: 'signer', name: 'Signer', type: 'standard' },
                    { address: 'watch', name: 'Watch', type: 'standard' },
                    { address: 'noauth', name: 'NoAuth', type: 'standard' },
                ],
                types: new Map([
                    ['signer', 'HdKey'],
                    ['watch', 'NoAuth'],
                    ['noauth', 'NoAuth'],
                ]),
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
                    { address: 'first', name: 'First', type: 'standard' },
                    { address: 'second', name: 'Second', type: 'standard' },
                    { address: 'third', name: 'Third', type: 'standard' },
                ],
                types: new Map([
                    ['first', 'HdKey'],
                    ['second', 'HdKey'],
                    ['third', 'HdKey'],
                ]),
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

        it('sends empty name string when account has no name', async () => {
            await setupAccountsMock({
                accounts: [{ address: 'nameless', type: 'standard' }],
                types: new Map([['nameless', 'HdKey']]),
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
                { name: '', address: 'nameless', type: 'HdKey' },
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

        const txns = [{}]
        const metadata = { name: 'Test dApp' }
        const address = 'addr1'

        await act(async () => {
            result.current.handleMessage({
                id: '13',
                jsonrpc: '2.0',
                method: 'requestTransactionSigning',
                params: { txns, metadata, address },
            })
        })

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'test-id',
                type: 'transactions',
                transport: 'callback',
                sourceMetadata: metadata,
            }),
        )

        // Test success
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        const signedTxs = [{ id: 'tx1' }]

        await act(async () => {
            await signRequest.approve(signedTxs)
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"13"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"signedTxs":[{"id":"tx1"}]'),
        )
    })

    it('should handle requestTransactionSigning error', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, null),
        )

        const txns = [{}]
        const metadata = { name: 'Test dApp' }
        const address = 'addr1'

        await act(async () => {
            result.current.handleMessage({
                id: '13-error',
                jsonrpc: '2.0',
                method: 'requestTransactionSigning',
                params: { txns, metadata, address },
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
                    params: { txns: [], metadata: {}, address: 'addr1' },
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

        it('auto-connects for a trusted origin with a valid wc URI', () => {
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

            expect(mockConnect).toHaveBeenCalledWith({
                connection: {
                    uri: 'wc:topic@2?relay-protocol=irn',
                    autoConnect: true,
                },
            })
        })

        it('shows the modal (autoConnect=false) for an untrusted origin with a valid wc URI', () => {
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
                    autoConnect: false,
                },
            })
        })
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
                    params: { txns: [] }, // missing metadata and address
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
                        txns: [{}],
                        metadata: { name: 'Test' },
                        address: 'addr1',
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
