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
import { Notifier } from 'react-native-notifier'
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
    useAllAccounts: jest.fn(() => [{ address: 'addr1', name: 'Account 1' }]),
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

jest.mock('@perawallet/wallet-core-blockchain', () => ({
    useSigningRequest: () => ({ addSignRequest: jest.fn() }),
}))

jest.mock('@perawallet/wallet-core-walletconnect', () => ({
    useWalletConnect: () => ({ connectSession: jest.fn() }),
}))

jest.mock('@rneui/themed', () => ({
    makeStyles: () => () => ({}),
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
                action: 'openSystemBrowser',
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
                action: 'openSystemBrowser',
                params: { url: 'https://example.com' },
            })
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(Notifier.showNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "Can't open webpage",
            }),
        )
    })

    it('should handle canOpenURI action', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true),
        )

        await act(async () => {
            result.current.handleMessage({
                action: 'canOpenURI',
                params: { uri: 'custom://uri' },
            })
        })

        await act(async () => {
            await Promise.resolve()
        })

        expect(Linking.canOpenURL).toHaveBeenCalledWith('custom://uri')
        expect(mockWebview.injectJavaScript).toHaveBeenCalledWith(
            'handleMessage(true);',
        )
    })

    it('should handle openNativeURI action', async () => {
        const { result } = renderHook(() =>
            usePeraWebviewInterface(mockWebview, true),
        )

        await act(async () => {
            result.current.handleMessage({
                action: 'openNativeURI',
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
                action: 'getSettings',
                params: {},
            })
        })

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
                action: 'getPublicSettings',
                params: {},
            })
        })

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
                action: 'logAnalyticsEvent',
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
                action: 'closeWebView',
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
                action: 'notifyUser',
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
                action: 'getAddresses',
                params: {},
            })
        })

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
                action: 'onBackPressed',
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
                action: 'pushWebView',
                params: { url: 'https://example.com' },
            })
        })

        expect(mockPushWebView).toHaveBeenCalledWith(
            expect.objectContaining({ url: 'https://example.com' }),
        )
    })
})
