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

import { renderHook } from '@test-utils/render'
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    NoConnectionError,
    PeraNetworkError,
} from '@perawallet/wallet-core-shared'

const mocks = vi.hoisted(() => ({ errorToast: vi.fn() }))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        infoToast: vi.fn(),
        errorToast: mocks.errorToast,
        showToast: vi.fn(),
        successToast: vi.fn(),
    }),
}))

import { useCardErrorToast } from '../useCardErrorToast'

describe('useCardErrorToast', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('surfaces the backend message when present', async () => {
        const { result } = renderHook(() => useCardErrorToast())

        await act(async () => {
            // ky HTTPError shape: status in `response`, parsed body in `data`.
            await result.current({
                response: { status: 400 },
                data: { message: "user doesn't have a card" },
            })
        })

        expect(mocks.errorToast).toHaveBeenCalledWith(
            expect.any(String),
            "user doesn't have a card",
        )
    })

    it('falls back to a generic body when the error has no message', async () => {
        const { result } = renderHook(() => useCardErrorToast())

        await act(async () => {
            await result.current(new Error('boom'))
        })

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'peraCard.account.error_title',
            'peraCard.account.error_body',
        )
    })

    it('uses the provided title/body keys for the fallback', async () => {
        const { result } = renderHook(() =>
            useCardErrorToast({
                titleKey: 'peraCard.verification.error_title',
                bodyKey: 'peraCard.verification.error_body',
            }),
        )

        await act(async () => {
            await result.current(new Error('boom'))
        })

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'peraCard.verification.error_title',
            'peraCard.verification.error_body',
        )
    })

    it('shows localized offline copy for connectivity errors', async () => {
        const { result } = renderHook(() => useCardErrorToast())

        await act(async () => {
            await result.current(new NoConnectionError())
        })

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'errors.network.no_connection.title',
            'errors.network.no_connection.body',
        )
    })

    it('shows localized offline copy for a proxy-route offline failure (PeraNetworkError)', async () => {
        const { result } = renderHook(() => useCardErrorToast())

        await act(async () => {
            await result.current(new PeraNetworkError('offline'))
        })

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'errors.network.no_connection.title',
            'errors.network.no_connection.body',
        )
    })

    it('shows localized offline copy for a raw ky NetworkError (direct Baanx path)', async () => {
        const { result } = renderHook(() => useCardErrorToast())

        // ky wraps a fetch `TypeError('Network request failed')` into its own
        // `NetworkError` (name: 'NetworkError') before it escapes the client —
        // the shape direct (non-proxied) Baanx calls actually throw. `ky` isn't
        // a direct dependency of apps/mobile, so this constructs that shape
        // structurally instead of importing the real class (see
        // vitest.setup.ts's isConnectivityError stand-in, which matches on
        // `error.name === 'NetworkError'` for the same reason).
        const networkError = new Error(
            'Request failed due to a network error: GET /card',
        )
        networkError.name = 'NetworkError'

        await act(async () => {
            await result.current(networkError)
        })

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'errors.network.no_connection.title',
            'errors.network.no_connection.body',
        )
    })

    it('prefers the backend message over the provided body key', async () => {
        const { result } = renderHook(() =>
            useCardErrorToast({
                titleKey: 'peraCard.verification.error_title',
                bodyKey: 'peraCard.verification.error_body',
            }),
        )

        await act(async () => {
            await result.current({
                response: { status: 400 },
                data: { message: 'Registration is not in the expected phase' },
            })
        })

        expect(mocks.errorToast).toHaveBeenCalledWith(
            'peraCard.verification.error_title',
            'Registration is not in the expected phase',
        )
    })
})
