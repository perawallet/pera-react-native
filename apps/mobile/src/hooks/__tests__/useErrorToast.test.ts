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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    AppError,
    NoConnectionError,
    PeraNetworkError,
    logger,
} from '@perawallet/wallet-core-shared'
import { AlgodError, toAlgodError } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import { useErrorToast } from '../useErrorToast'

const { mockShowToast, mockGetMessage } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockGetMessage: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
}))

vi.mock('../useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('../useAlgodErrorMessage', () => ({
    useAlgodErrorMessage: () => ({ getMessage: mockGetMessage }),
}))

vi.mock('../useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

class TestAppError extends AppError {
    constructor(message: string) {
        super(message, {})
    }
}

describe('useErrorToast', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(config as { debugEnabled: boolean }).debugEnabled = false
        mockGetMessage.mockReturnValue({
            title: 'algod title',
            body: 'algod body',
        })
        ;(toAlgodError as Mock).mockReturnValue(
            new AlgodError('unknown_node_error', { raw: 'unknown' }),
        )
    })

    it('uses the algod-specific title and body for an AlgodError', () => {
        const algodError = new AlgodError('overspend', {
            address: 'A',
            balance: 0n,
            spent: 0n,
            missing: 0n,
        })
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(algodError, 'fallback title')
        })

        expect(mockGetMessage).toHaveBeenCalledWith(algodError)
        expect(mockShowToast).toHaveBeenCalledWith(
            { title: 'algod title', body: 'algod body', type: 'error' },
            undefined,
        )
    })

    it('uses fallback title and the localized generic body for an AppError without a messageKey', () => {
        const appError = new TestAppError('Insufficient ALGO balance to opt in')
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(appError, 'Could not add asset')
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'Could not add asset',
                body: 'errors.general.body',
                type: 'error',
            },
            undefined,
        )
    })

    it('falls back to generic title and body when no fallback is provided for AppError', () => {
        const appError = new TestAppError('boom')
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(appError)
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'errors.general.title',
                body: 'errors.general.body',
                type: 'error',
            },
            undefined,
        )
    })

    it('translates a recognizable plain Error via toAlgodError', () => {
        const recognizableAlgodError = new AlgodError('overspend', {
            address: 'A',
            balance: 0n,
            spent: 0n,
            missing: 0n,
        })
        ;(toAlgodError as Mock).mockReturnValueOnce(recognizableAlgodError)
        const raw = new Error('overspend (account ABC...)')

        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(raw, 'Transaction failed')
        })

        expect(mockGetMessage).toHaveBeenCalledWith(recognizableAlgodError)
        expect(mockShowToast).toHaveBeenCalledWith(
            { title: 'algod title', body: 'algod body', type: 'error' },
            undefined,
        )
    })

    it('falls back to generic body when toAlgodError yields unknown_node_error', () => {
        const raw = new Error('something opaque')

        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(raw, 'Transaction failed')
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'Transaction failed',
                body: 'errors.general.body',
                type: 'error',
            },
            undefined,
        )
    })

    it('logs the raw message when falling back to the generic banner', () => {
        const raw = new Error(
            'Network request error. Received status 403 (Forbidden): invalid token',
        )

        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(raw)
        })

        expect(logger.error).toHaveBeenCalledWith(
            'Unrecognized error shown as generic banner',
            expect.objectContaining({
                message: expect.stringContaining('403'),
            }),
        )
    })

    it('appends raw error detail to the body when debug is enabled', () => {
        ;(config as { debugEnabled: boolean }).debugEnabled = true
        const appError = new TestAppError('user-facing copy')

        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(appError, 'Failed')
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Failed',
                body: 'errors.general.body\n\nDebug: user-facing copy',
                type: 'error',
            }),
            undefined,
        )
    })

    it('passes through toast options to showToast', () => {
        const options = { notifier: { current: 'notifier-stub' } as never }
        const appError = new TestAppError('boom')

        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(appError, 'Failed', options)
        })

        expect(mockShowToast).toHaveBeenCalledWith(expect.any(Object), options)
    })

    it('logs the raw value when falling back to the generic banner for a non-Error input', () => {
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(null)
        })

        expect(logger.error).toHaveBeenCalledWith(
            'Unrecognized error shown as generic banner',
            { message: 'null' },
        )
    })

    it('uses generic copy for non-Error inputs', () => {
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError('a string error', 'Custom title')
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'Custom title',
                body: 'errors.general.body',
                type: 'error',
            },
            undefined,
        )
    })

    it('renders offline copy for a PeraNetworkError(offline)', () => {
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(new PeraNetworkError('offline'))
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'errors.network.no_connection.title',
                body: 'errors.network.no_connection.body',
                type: 'error',
            },
            undefined,
        )
    })

    it('ignores a provided fallbackTitle for a specific-kind PeraNetworkError(offline)', () => {
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(
                new PeraNetworkError('offline'),
                'Custom fallback title',
            )
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'errors.network.no_connection.title',
                body: 'errors.network.no_connection.body',
                type: 'error',
            },
            undefined,
        )
    })

    it('renders general copy only for unknown-kind network errors', () => {
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(new PeraNetworkError('unknown'))
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'errors.general.title',
                body: 'errors.general.body',
                type: 'error',
            },
            undefined,
        )
    })

    it('honors a provided fallbackTitle for unknown-kind network errors', () => {
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(
                new PeraNetworkError('unknown'),
                'Custom fallback title',
            )
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'Custom fallback title',
                body: 'errors.general.body',
                type: 'error',
            },
            undefined,
        )
    })

    it('shows localized offline copy for NoConnectionError', () => {
        const { result } = renderHook(() => useErrorToast())

        act(() => {
            result.current.showError(new NoConnectionError())
        })

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: 'errors.network.no_connection.title',
                body: 'errors.network.no_connection.body',
                type: 'error',
            },
            undefined,
        )
    })
})
