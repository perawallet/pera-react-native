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
    useLanguage: () => ({
        t: (key: string, values?: Record<string, string>) =>
            values ? `${key}:${JSON.stringify(values)}` : key,
    }),
}))

describe('useDeeplinkErrorHandler', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        mockErrorToast.mockClear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('fills the copy with the names it is given', () => {
        const { result } = renderHook(() => useDeeplinkErrorHandler())

        act(() => {
            result.current({
                variant: 'no-account',
                values: { chain: 'Ethereum' },
            })
            vi.runAllTimers()
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'deeplink.error.title_no_account:{"chain":"Ethereum"}',
            'deeplink.error.body_no_account:{"chain":"Ethereum"}',
        )
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
        [
            'walletconnect_timeout',
            'deeplink.error.title_walletconnect',
            'deeplink.error.body_walletconnect_timeout',
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
        [
            'network-mismatch',
            'deeplink.error.title_network_mismatch',
            'deeplink.error.body_network_mismatch',
        ],
        [
            'no-account',
            'deeplink.error.title_no_account',
            'deeplink.error.body_no_account',
        ],
        [
            'unsupported-on-chain',
            'deeplink.error.title_unsupported',
            'deeplink.error.body_unsupported_on_chain',
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

    it.each([
        ['chain-action', 'deeplink.error.body_keyreg'],
        [
            'chain-action-unknown-account',
            'deeplink.error.body_keyreg_unknown_account',
        ],
        ['chain-action-cannot-sign', 'deeplink.error.body_keyreg_cannot_sign'],
    ] as const)(
        'maps a keyreg action\'s "%s" variant to the key-registration copy',
        (variant, body) => {
            const { result } = renderHook(() => useDeeplinkErrorHandler())

            act(() => {
                result.current({ variant, action: 'keyreg' })
                vi.advanceTimersByTime(500)
            })

            expect(mockErrorToast).toHaveBeenCalledExactlyOnceWith(
                'deeplink.error.title_keyreg',
                body,
            )
        },
    )

    it('overrides the caller-supplied variant when the error is tagged as a timeout', () => {
        // Any handler can throw a DeeplinkTimeoutError when withTimeout
        // races out. The error sheet should surface the timeout message
        // rather than the original variant the caller specified.
        const { result } = renderHook(() => useDeeplinkErrorHandler())

        act(() => {
            result.current({
                variant: 'chain-action',
                action: 'keyreg',
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
                variant: 'chain-action',
                action: 'keyreg',
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
