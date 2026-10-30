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
import { renderHook } from '@testing-library/react'
import { useQRScannerContent } from '../useQRScannerContent.web'

const mocks = vi.hoisted(() => ({
    handleDeepLink: vi.fn(),
    isValidDeepLink: vi.fn(),
    parseDeeplink: vi.fn(),
    errorToast: vi.fn(),
    openExpandedTab: vi.fn(),
}))

vi.mock('@modules/deeplink', () => ({
    useDeepLink: () => ({
        handleDeepLink: mocks.handleDeepLink,
        isValidDeepLink: mocks.isValidDeepLink,
        parseDeeplink: mocks.parseDeeplink,
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mocks.errorToast }),
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getSurface: () => 'expanded',
}))

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    openExpandedTab: mocks.openExpandedTab,
}))

// Callbacks captured from the last dispatch, so a spec resolves the path it
// needs: handleDeepLink(url, replace, source, onError, onSuccess,
// onConnectionError). Re-arming happens on the error/connection paths and in
// the success callback itself (via the restart argument it hands onSuccess).
type Dispatcher = {
    onError: () => void
    onSuccess: () => void
    onConnectionError: () => void
}
let dispatcher: Dispatcher | undefined

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    logger: { debug: vi.fn(), error: vi.fn() },
}))

describe('useQRScannerContent (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        dispatcher = undefined
        mocks.isValidDeepLink.mockReturnValue(true)
        mocks.handleDeepLink.mockImplementation(
            (
                value,
                _replace,
                _source,
                onError,
                onSuccess,
                onConnectionError,
            ) => {
                dispatcher = { onError, onSuccess, onConnectionError }
                return Promise.resolve()
            },
        )
        mocks.parseDeeplink.mockReturnValue({ type: 'send' })
    })

    it('toasts and re-arms the scanner on a near-miss decode', () => {
        mocks.isValidDeepLink.mockReturnValue(false)
        const onRestart = vi.fn()
        const { result } = renderHook(() =>
            useQRScannerContent({ onSuccess: vi.fn(), onRestart }),
        )

        result.current.handleResult('not-a-link')

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'qr_scanner.invalid_code',
            '',
        )
        expect(onRestart).toHaveBeenCalledOnce()
        expect(mocks.handleDeepLink).not.toHaveBeenCalled()
    })

    it('hands a valid deep link to the dispatcher and closes on success', () => {
        const onSuccess = vi.fn()
        const onRestart = vi.fn()
        const { result } = renderHook(() =>
            useQRScannerContent({ onSuccess, onRestart }),
        )

        result.current.handleResult('pera://send/abc')
        expect(onSuccess).not.toHaveBeenCalled()

        dispatcher?.onSuccess()

        expect(mocks.parseDeeplink).toHaveBeenCalledWith('pera://send/abc')
        expect(onSuccess).toHaveBeenCalledWith(
            'pera://send/abc',
            expect.any(Function),
        )

        // The restart argument re-arms the scanner after the dispatch.
        onSuccess.mock.calls[0][1]()

        expect(onRestart).toHaveBeenCalledOnce()
    })

    it('swallows a second result while one is still dispatching', () => {
        const onRestart = vi.fn()
        const { result } = renderHook(() =>
            useQRScannerContent({ onSuccess: vi.fn(), onRestart }),
        )

        result.current.handleResult('pera://send/abc')
        result.current.handleResult('pera://send/def')

        // The dispatch runs once; the second value never enters it.
        expect(mocks.handleDeepLink).toHaveBeenCalledOnce()
        expect(mocks.handleDeepLink).toHaveBeenCalledWith(
            'pera://send/abc',
            false,
            'qr',
            expect.any(Function),
            expect.any(Function),
            expect.any(Function),
        )

        // The failed dispatch re-arms the scanner.
        dispatcher?.onError()

        expect(onRestart).toHaveBeenCalledOnce()
    })

    it('reports a dispatch error back to the scanner', () => {
        const onSuccess = vi.fn()
        const onRestart = vi.fn()
        const { result } = renderHook(() =>
            useQRScannerContent({ onSuccess, onRestart }),
        )

        result.current.handleResult('pera://send/abc')
        dispatcher?.onError()

        expect(onSuccess).not.toHaveBeenCalled()
        expect(onRestart).toHaveBeenCalledOnce()
    })
})
