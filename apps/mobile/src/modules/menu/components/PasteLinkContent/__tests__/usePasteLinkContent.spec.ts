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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    isValidDeepLink: vi.fn(),
    handleDeepLink: vi.fn(),
}))

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: () => ({
        isValidDeepLink: mocks.isValidDeepLink,
        handleDeepLink: mocks.handleDeepLink,
    }),
}))

import { usePasteLinkContent } from '../usePasteLinkContent'

const WC_URI = 'wc:topic@1?bridge=https%3A%2F%2Fbridge.example&key=abc'

describe('usePasteLinkContent', () => {
    beforeEach(() => {
        mocks.isValidDeepLink.mockReturnValue(true)
        mocks.handleDeepLink.mockResolvedValue(undefined)
    })

    it('sets hasError and does not dispatch an unrecognised value', async () => {
        mocks.isValidDeepLink.mockReturnValue(false)
        const onClose = vi.fn()
        const { result } = renderHook(() => usePasteLinkContent(onClose))
        act(() => result.current.setValue('not-a-link'))
        await act(async () => result.current.handleSubmit())
        expect(result.current.hasError).toBe(true)
        expect(result.current.errorMessageKey).toBe('paste_link.error_invalid')
        expect(mocks.handleDeepLink).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    it('dispatches a valid value with the qr source', async () => {
        const onClose = vi.fn()
        const { result } = renderHook(() => usePasteLinkContent(onClose))
        act(() => result.current.setValue(WC_URI))
        await act(async () => result.current.handleSubmit())
        expect(mocks.handleDeepLink).toHaveBeenCalledOnce()
        const args = mocks.handleDeepLink.mock.calls[0]
        expect(args[0]).toBe(WC_URI)
        expect(args[2]).toBe('qr')
    })

    it('closes the sheet on a successful dispatch', async () => {
        mocks.handleDeepLink.mockImplementation(
            async (
                _url: string,
                _replace: boolean | undefined,
                _source: string,
                _onError?: () => void,
                onSuccess?: () => void,
            ) => {
                onSuccess?.()
            },
        )
        const onClose = vi.fn()
        const { result } = renderHook(() => usePasteLinkContent(onClose))
        act(() => result.current.setValue(WC_URI))
        await act(async () => result.current.handleSubmit())
        expect(onClose).toHaveBeenCalledOnce()
    })

    it('keeps the sheet open and shows the "failed" copy when the dispatcher calls onError', async () => {
        mocks.handleDeepLink.mockImplementation(
            async (
                _url: string,
                _replace: boolean | undefined,
                _source: string,
                onError?: () => void,
            ) => {
                onError?.()
            },
        )
        const onClose = vi.fn()
        const { result } = renderHook(() => usePasteLinkContent(onClose))
        act(() => result.current.setValue(WC_URI))
        await act(async () => result.current.handleSubmit())
        expect(onClose).not.toHaveBeenCalled()
        expect(result.current.hasError).toBe(true)
        expect(result.current.errorMessageKey).toBe('paste_link.error_failed')
        expect(result.current.isSubmitting).toBe(false)
    })

    it('keeps the sheet open and shows the "failed" copy when the dispatcher calls onConnectionError', async () => {
        mocks.handleDeepLink.mockImplementation(
            async (
                _url: string,
                _replace: boolean | undefined,
                _source: string,
                _onError?: () => void,
                _onSuccess?: () => void,
                onConnectionError?: () => void,
            ) => {
                onConnectionError?.()
            },
        )
        const onClose = vi.fn()
        const { result } = renderHook(() => usePasteLinkContent(onClose))
        act(() => result.current.setValue(WC_URI))
        await act(async () => result.current.handleSubmit())
        expect(onClose).not.toHaveBeenCalled()
        expect(result.current.hasError).toBe(true)
        // Distinct from the isValidDeepLink rejection copy — same underlying
        // cause as onError (recognised but couldn't open), not "not a link".
        expect(result.current.errorMessageKey).toBe('paste_link.error_failed')
    })

    it('ignores an empty value', async () => {
        const { result } = renderHook(() => usePasteLinkContent(vi.fn()))
        await act(async () => result.current.handleSubmit())
        expect(mocks.isValidDeepLink).not.toHaveBeenCalled()
        expect(mocks.handleDeepLink).not.toHaveBeenCalled()
    })

    it('clears a previous error when the value changes', async () => {
        mocks.isValidDeepLink.mockReturnValue(false)
        const { result } = renderHook(() => usePasteLinkContent(vi.fn()))
        act(() => result.current.setValue('bad'))
        await act(async () => result.current.handleSubmit())
        expect(result.current.hasError).toBe(true)
        act(() => result.current.setValue('bad2'))
        expect(result.current.hasError).toBe(false)
    })

    it('trims surrounding whitespace before validating and dispatching', async () => {
        const onClose = vi.fn()
        const { result } = renderHook(() => usePasteLinkContent(onClose))
        act(() => result.current.setValue(`  ${WC_URI}  `))
        await act(async () => result.current.handleSubmit())
        expect(mocks.isValidDeepLink).toHaveBeenCalledWith(WC_URI)
        expect(mocks.handleDeepLink).toHaveBeenCalledOnce()
        // Anchors on the actual dispatch argument — deleting `.trim()` from
        // handleSubmit would send the untrimmed, padded value here instead.
        expect(mocks.handleDeepLink.mock.calls[0][0]).toBe(WC_URI)
    })

    it('treats a whitespace-only value as empty', async () => {
        const { result } = renderHook(() => usePasteLinkContent(vi.fn()))
        act(() => result.current.setValue('   '))
        await act(async () => result.current.handleSubmit())
        expect(mocks.isValidDeepLink).not.toHaveBeenCalled()
        expect(mocks.handleDeepLink).not.toHaveBeenCalled()
    })

    it('ignores a second submit while the first dispatch is still in flight', async () => {
        let resolveDispatch: () => void = () => {}
        mocks.handleDeepLink.mockImplementation(
            () =>
                new Promise<void>(resolve => {
                    resolveDispatch = resolve
                }),
        )
        const { result } = renderHook(() => usePasteLinkContent(vi.fn()))
        act(() => result.current.setValue(WC_URI))
        act(() => {
            result.current.handleSubmit()
            result.current.handleSubmit()
        })
        expect(mocks.handleDeepLink).toHaveBeenCalledOnce()
        // Let the in-flight dispatch settle so it doesn't leak into other tests.
        await act(async () => resolveDispatch())
    })

    it('settles after a rejecting dispatch and allows a later submit to go through', async () => {
        mocks.handleDeepLink.mockRejectedValueOnce(new Error('boom'))
        const onClose = vi.fn()
        const { result } = renderHook(() => usePasteLinkContent(onClose))
        act(() => result.current.setValue(WC_URI))
        await act(async () => result.current.handleSubmit())
        expect(result.current.isSubmitting).toBe(false)
        expect(onClose).not.toHaveBeenCalled()

        mocks.handleDeepLink.mockResolvedValueOnce(undefined)
        act(() => result.current.setValue(WC_URI))
        await act(async () => result.current.handleSubmit())
        expect(mocks.handleDeepLink).toHaveBeenCalledTimes(2)
    })
})
