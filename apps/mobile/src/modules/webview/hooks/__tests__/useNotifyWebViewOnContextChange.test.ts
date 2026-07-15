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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    useNotifyWebViewOnContextChange,
    type ContextFingerprints,
} from '../useNotifyWebViewOnContextChange'

vi.mock('@perawallet/wallet-core-shared', () => ({
    logger: { debug: vi.fn() },
}))

vi.mock('react-native-webview', () => ({ default: {} }))

describe('useNotifyWebViewOnContextChange', () => {
    const mockInjectJavaScript = vi.fn()

    const webviewRef = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        current: { injectJavaScript: mockInjectJavaScript } as any,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not send notification on first render (no previous fingerprints)', () => {
        renderHook(() =>
            useNotifyWebViewOnContextChange(webviewRef, {
                settings: 'light-USD-mainnet-en',
                accounts: 'addr1',
            }),
        )

        expect(mockInjectJavaScript).not.toHaveBeenCalled()
    })

    it('does nothing when contextFingerprints is undefined', () => {
        renderHook(() => useNotifyWebViewOnContextChange(webviewRef, undefined))

        expect(mockInjectJavaScript).not.toHaveBeenCalled()
    })

    it('sends notification with settings context when settings fingerprint changes', () => {
        const { rerender } = renderHook(
            ({ fingerprints }) =>
                useNotifyWebViewOnContextChange(webviewRef, fingerprints),
            {
                initialProps: {
                    fingerprints: {
                        settings: 'light-USD-mainnet-en',
                        accounts: 'addr1',
                    },
                },
            },
        )

        rerender({
            fingerprints: {
                settings: 'dark-USD-mainnet-en',
                accounts: 'addr1',
            },
        })

        expect(mockInjectJavaScript).toHaveBeenCalledTimes(1)
        expect(mockInjectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"contexts":["settings"]'),
        )
    })

    it('sends notification with accounts context when accounts fingerprint changes', () => {
        const { rerender } = renderHook(
            ({ fingerprints }) =>
                useNotifyWebViewOnContextChange(webviewRef, fingerprints),
            {
                initialProps: {
                    fingerprints: {
                        settings: 'light-USD-mainnet-en',
                        accounts: 'addr1',
                    },
                },
            },
        )

        rerender({
            fingerprints: {
                settings: 'light-USD-mainnet-en',
                accounts: 'addr1,addr2',
            },
        })

        expect(mockInjectJavaScript).toHaveBeenCalledTimes(1)
        expect(mockInjectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"contexts":["accounts"]'),
        )
    })

    it('sends notification with both contexts when both fingerprints change', () => {
        const { rerender } = renderHook(
            ({ fingerprints }) =>
                useNotifyWebViewOnContextChange(webviewRef, fingerprints),
            {
                initialProps: {
                    fingerprints: {
                        settings: 'light-USD-mainnet-en',
                        accounts: 'addr1',
                    },
                },
            },
        )

        rerender({
            fingerprints: {
                settings: 'dark-EUR-testnet-de',
                accounts: 'addr2',
            },
        })

        expect(mockInjectJavaScript).toHaveBeenCalledTimes(1)
        expect(mockInjectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"contexts":["settings","accounts"]'),
        )
    })

    it('does not send notification when fingerprints are unchanged', () => {
        const { rerender } = renderHook(
            ({ fingerprints }) =>
                useNotifyWebViewOnContextChange(webviewRef, fingerprints),
            {
                initialProps: {
                    fingerprints: {
                        settings: 'light-USD-mainnet-en',
                        accounts: 'addr1',
                    },
                },
            },
        )

        rerender({
            fingerprints: {
                settings: 'light-USD-mainnet-en',
                accounts: 'addr1',
            },
        })

        expect(mockInjectJavaScript).not.toHaveBeenCalled()
    })

    it('sends a valid JSON-RPC notification format', () => {
        const { rerender } = renderHook(
            ({ fingerprints }) =>
                useNotifyWebViewOnContextChange(webviewRef, fingerprints),
            {
                initialProps: {
                    fingerprints: {
                        settings: 'light-USD-mainnet-en',
                        accounts: 'addr1',
                    },
                },
            },
        )

        rerender({
            fingerprints: {
                settings: 'dark-USD-mainnet-en',
                accounts: 'addr1',
            },
        })

        expect(mockInjectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"jsonrpc":"2.0"'),
        )
        expect(mockInjectJavaScript).toHaveBeenCalledWith(
            expect.stringContaining('"method":"onHostContextChanged"'),
        )
    })

    it('does not send notification when webview ref is null', () => {
        const nullRef = { current: null }

        const { rerender } = renderHook(
            ({ fingerprints }) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                useNotifyWebViewOnContextChange(nullRef as any, fingerprints),
            {
                initialProps: {
                    fingerprints: {
                        settings: 'light-USD-mainnet-en',
                        accounts: 'addr1',
                    },
                },
            },
        )

        rerender({
            fingerprints: {
                settings: 'dark-USD-mainnet-en',
                accounts: 'addr1',
            },
        })

        expect(mockInjectJavaScript).not.toHaveBeenCalled()
    })

    it('does not send notification when a fingerprint key is first introduced (no prior value)', () => {
        // Only accounts is set initially — settings key is absent
        const { rerender } = renderHook(
            ({ fingerprints }) =>
                useNotifyWebViewOnContextChange(webviewRef, fingerprints),
            {
                initialProps: {
                    fingerprints: { accounts: 'addr1' } as ContextFingerprints,
                },
            },
        )

        // Now settings is introduced for the first time
        rerender({
            fingerprints: {
                settings: 'light-USD-mainnet-en',
                accounts: 'addr1',
            },
        })

        // settings had no prior value, so it should not trigger a notification
        expect(mockInjectJavaScript).not.toHaveBeenCalled()
    })
})
