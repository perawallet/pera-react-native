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

import { renderHook, act } from '@testing-library/react-native'
import { usePeraWebviewInterface, useWebView } from '../webview'
import { Linking } from 'react-native'
import React from 'react'
import { WebViewContext } from '@providers/WebViewProvider'

jest.mock('react-native', () => ({
    Platform: {
        OS: 'ios',
        select: jest.fn(obj => obj.ios || obj.default),
    },
    Linking: {
        canOpenURL: jest.fn().mockResolvedValue(true),
        openURL: jest.fn().mockResolvedValue(true),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    View: ({ children }: any) => children,
}))

jest.mock('react-native-notifier', () => ({
    Notifier: {
        showNotification: jest.fn(),
    },
}))

jest.mock('@perawallet/wallet-core-shared', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
    },
    createLazyStore: jest.fn(() => () => ({})),
}))

jest.mock('@perawallet/wallet-core-platform-integration', () => ({
    useAnalyticsService: jest.fn(() => ({
        logEvent: jest.fn(),
    })),
    useDeviceID: jest.fn(() => 'device-id'),
    useDeviceInfoService: jest.fn(() => ({
        getAppVersion: jest.fn(() => '1.0.0'),
        getDevicePlatform: jest.fn(() => 'ios'),
        getDeviceModel: jest.fn(() => 'iPhone'),
    })),
    useNetwork: jest.fn(() => ({
        network: 'mainnet',
    })),
}))

jest.mock('@perawallet/wallet-core-accounts', () => ({
    getAccountDisplayName: jest.fn(account => account.name),
    isHDWalletAccount: jest.fn(account => account.type === 'standard'),
    useAllAccounts: jest.fn(() => [
        {
            address: 'addr1',
            name: 'Account 1',
            type: 'standard',
            hdWalletDetails: { hdWalletAddress: 'addr1' },
        },
    ]),
}))

jest.mock('@perawallet/wallet-core-settings', () => ({
    useSettings: jest.fn(() => ({
        theme: 'light',
    })),
}))

jest.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: jest.fn(() => ({
        preferredCurrency: 'USD',
    })),
}))

const mockAddSignRequest = jest.fn()
jest.mock('@perawallet/wallet-core-blockchain', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
}))

jest.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({ connectSession: jest.fn() }),
}))

jest.mock('@rneui/themed', () => ({
    makeStyles: () => () => ({}),
}))

jest.mock('../language', () => ({
    useLanguage: jest.fn(() => ({
        t: (key: string, params?: Record<string, string>) => {
            if (key === 'errors.webview.unsupported_url' && params?.url) {
                return `Unsupported URL: ${params.url}`
            }
            return key
        },
    })),
}))

describe('useWebView', () => {
    it('should provide pushWebView from context', () => {
        const mockPushWebView = jest.fn()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <WebViewContext.Provider
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                value={{ pushWebView: mockPushWebView } as any}
            >
                {children}
            </WebViewContext.Provider>
        )
        const { result } = renderHook(() => useWebView(), { wrapper })
        expect(result.current.pushWebView).toBe(mockPushWebView)
    })
})

describe('usePeraWebviewInterface', () => {
    const mockWebview = {
        injectJavaScript: jest.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    beforeEach(() => {
        jest.clearAllMocks()
        ;(Linking.canOpenURL as jest.Mock).mockResolvedValue(true)
        ;(Linking.openURL as jest.Mock).mockResolvedValue(true)
    })

    it('should handle openSystemBrowser action', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true),
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
        ;(Linking.canOpenURL as jest.Mock).mockResolvedValue(false)
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true),
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
            usePeraWebviewInterface(mockWebview, true),
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
            usePeraWebviewInterface(mockWebview, true),
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
            usePeraWebviewInterface(mockWebview, true),
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
    })

    it('should handle getPublicSettings action', () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true),
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
            usePeraWebviewInterface(mockWebview, true),
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
        const mockOnClose = jest.fn()
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true, mockOnClose),
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
            usePeraWebviewInterface(mockWebview, true),
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
            usePeraWebviewInterface(mockWebview, true),
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

    it('should handle onBackPressed action', () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true),
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
        const mockPushWebView = jest.fn()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <WebViewContext.Provider
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                value={{ pushWebView: mockPushWebView } as any}
            >
                {children}
            </WebViewContext.Provider>
        )
        const { result } = renderHook(
            () => usePeraWebviewInterface(mockWebview, true),
            { wrapper },
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
            usePeraWebviewInterface(mockWebview, true),
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
                id: '13',
                type: 'transactions',
                transport: 'callback',
                sourceMetadata: metadata,
            }),
        )

        // Test success
        const signRequest = mockAddSignRequest.mock.calls[0][0]
        const signedTxs = [{ id: 'tx1' }]

        await act(async () => {
            await signRequest.success(signedTxs)
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
            usePeraWebviewInterface(mockWebview, true),
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
            await signRequest.error('User rejected')
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"13-error"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining(
                '"error":{"code":-32603,"message":"User rejected"}',
            ),
        )
    })

    it('should handle requestDataSigning action', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true),
        )

        const data = { data: 'AQID', message: 'Sign this' }
        const metadata = { name: 'Test dApp' }
        const address = 'addr1'

        await act(async () => {
            result.current.handleMessage({
                id: '14',
                jsonrpc: '2.0',
                method: 'requestDataSigning',
                params: { data, metadata, address },
            })
        })

        expect(mockAddSignRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                id: '14',
                type: 'arbitrary-data',
                transport: 'callback',
                data: 'AQID',
                message: 'Sign this',
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
            await signRequest.success(address, signature)
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"14"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"signature":"BAUG"'), // [4,5,6] in base64 is BAUG
        )
    })

    it('should handle requestDataSigning error', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true),
        )

        const data = { data: 'AQID' }
        const metadata = { name: 'Test dApp' }
        const address = 'addr1'

        await act(async () => {
            result.current.handleMessage({
                id: '14-error',
                jsonrpc: '2.0',
                method: 'requestDataSigning',
                params: { data, metadata, address },
            })
        })

        const signRequest =
            mockAddSignRequest.mock.calls[
                mockAddSignRequest.mock.calls.length - 1
            ][0]

        await act(async () => {
            await signRequest.error('Unauthorized')
        })

        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"id":"14-error"'),
        )
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining(
                '"error":{"code":-32603,"message":"Unauthorized"}',
            ),
        )
    })

    describe('insecure connection handling', () => {
        it('should silently return for getAddresses when connection is insecure', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, false),
            )

            act(() => {
                result.current.handleMessage({
                    id: '15',
                    jsonrpc: '2.0',
                    method: 'getAddresses',
                    params: {},
                })
            })

            // Should not inject any message since connection is insecure
            expect(mockWebview.injectJavaScript).not.toHaveBeenCalled()
        })

        it('should silently return for getSettings when connection is insecure', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, false),
            )

            act(() => {
                result.current.handleMessage({
                    id: '16',
                    jsonrpc: '2.0',
                    method: 'getSettings',
                    params: {},
                })
            })

            expect(mockWebview.injectJavaScript).not.toHaveBeenCalled()
        })

        it('should silently return for requestTransactionSigning when connection is insecure', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, false),
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
        })
    })

    describe('missing parameter validation', () => {
        it('should send error for pushWebView with missing url', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true),
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
                usePeraWebviewInterface(mockWebview, true),
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
                usePeraWebviewInterface(mockWebview, true),
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
                usePeraWebviewInterface(mockWebview, true),
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
                usePeraWebviewInterface(mockWebview, true),
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
                usePeraWebviewInterface(mockWebview, true),
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
                usePeraWebviewInterface(mockWebview, true),
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
                usePeraWebviewInterface(mockWebview, true),
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

    describe('unknown method handling', () => {
        it('should send error for unknown method', () => {
            const { result } = renderHook(() =>
                usePeraWebviewInterface(mockWebview, true),
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
})
