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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useDeeplinkErrorHandler } from '../useDeeplinkErrorHandler'
import { DeeplinkTimeoutError } from '../timeout'

const mockErrorToast = vi.fn()

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    // i18n echoes the key in tests so we can assert on the mapping directly.
    useLanguage: () => ({ t: (key: string) => key }),
}))

describe('useDeeplinkErrorHandler', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockErrorToast.mockClear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it.each([
        [
            'generic',
            'deeplink.error.title_generic',
            'deeplink.error.body_generic',
        ],
        [
            'walletconnect',
            'deeplink.error.title_walletconnect',
            'deeplink.error.body_walletconnect',
        ],
        ['keyreg', 'deeplink.error.title_keyreg', 'deeplink.error.body_keyreg'],
        [
            'keyreg-unknown-account',
            'deeplink.error.title_keyreg',
            'deeplink.error.body_keyreg_unknown_account',
        ],
        [
            'recover',
            'deeplink.error.title_recover',
            'deeplink.error.body_recover',
        ],
        [
            'recover_duplicate',
            'deeplink.error.title_recover',
            'deeplink.error.body_recover_duplicate',
        ],
        [
            'timeout',
            'deeplink.error.title_timeout',
            'deeplink.error.body_timeout',
        ],
    ] as const)('maps variant "%s" to (%s, %s)', (variant, title, body) => {
        const { result } = renderHook(() => useDeeplinkErrorHandler())

        act(() => {
            result.current({ variant })
        })
        // The toast is deferred so the QR scanner Modal can dismiss first;
        // assert the deferral exists by checking that nothing fires until
        // we advance time past TOAST_DEFER_MS.
        expect(mockErrorToast).not.toHaveBeenCalled()
        act(() => {
            vi.advanceTimersByTime(500)
        })
        expect(mockErrorToast).toHaveBeenCalledExactlyOnceWith(title, body)
    })

    it('overrides the caller-supplied variant when the error is tagged as a timeout', () => {
        // Any handler can throw a DeeplinkTimeoutError when withTimeout
        // races out. The error sheet should surface the timeout message
        // rather than the original variant the caller specified.
        const { result } = renderHook(() => useDeeplinkErrorHandler())

        act(() => {
            result.current({
                variant: 'keyreg',
                error: new DeeplinkTimeoutError(
                    'algokit.suggestedParams',
                    12_000,
                ),
            })
            vi.advanceTimersByTime(500)
        })

        expect(mockErrorToast).toHaveBeenCalledExactlyOnceWith(
            'deeplink.error.title_timeout',
            'deeplink.error.body_timeout',
        )
    })

    it('keeps the caller-supplied variant when the error is a plain Error without the timeout tag', () => {
        const { result } = renderHook(() => useDeeplinkErrorHandler())

        act(() => {
            result.current({
                variant: 'keyreg',
                error: new Error('algod returned 500'),
            })
            vi.advanceTimersByTime(500)
        })

        expect(mockErrorToast).toHaveBeenCalledExactlyOnceWith(
            'deeplink.error.title_keyreg',
            'deeplink.error.body_keyreg',
        )
    })
})
