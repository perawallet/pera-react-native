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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSigningActionButtons } from '../useSigningActionButtons'
import {
    isSignRequestMultisigUnsignable,
    useSigningPipeline,
    useSigningRequest,
    type TransactionWarning,
    type SigningPipelineEvent,
} from '@perawallet/wallet-core-signing'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useNavigation } from '@react-navigation/native'
import { useErrorToast } from '@hooks/useErrorToast'
import { useBottomSheet } from '@modules/bottom-sheet'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
    useSigningRequest: vi.fn(),
    isSignRequestMultisigUnsignable: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: vi.fn(() => ({ showError: vi.fn() })),
}))

vi.mock('@components/core', () => ({
    bottomSheetNotifier: { current: null },
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: vi.fn(),
}))

describe('useSigningActionButtons', () => {
    const mockNext = vi.fn()
    const mockFail = vi.fn()
    const mockNavigate = vi.fn()
    const mockGetPreference = vi.fn()
    const mockRequestBottomSheet = vi.fn()
    const mockRequest = { id: 'test', transport: 'algod', txs: [] }

    const setupPipeline = (
        warnings: TransactionWarning[] = [],
        allTransactions: unknown[] = [],
    ) => {
        ;(useSigningPipeline as Mock).mockReturnValue({
            currentRequest: mockRequest,
            allTransactions,
            warnings,
            isLoading: false,
            next: mockNext,
            fail: mockFail,
            resolved: null,
        })
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockGetPreference.mockReturnValue(undefined)
        setupPipeline()
        ;(useSigningRequest as Mock).mockReturnValue({
            currentRequest: undefined,
        })
        ;(usePreferences as Mock).mockReturnValue({
            getPreference: mockGetPreference,
        })
        ;(useNavigation as Mock).mockReturnValue({
            navigate: mockNavigate,
        })
        mockRequestBottomSheet.mockResolvedValue(undefined)
        ;(useBottomSheet as Mock).mockReturnValue({
            request: mockRequestBottomSheet,
        })
    })

    it('signs directly when there are no guarded warnings', () => {
        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    it('opens security guard sheet instead of signing when rekey warnings exist', () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('opens security guard sheet when asset-freeze warnings exist', () => {
        setupPipeline([
            {
                type: 'asset-freeze',
                senderAddress: 'addr1',
                targetAddress: 'addr2',
            },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('proceeds with signing when security guard resolves with confirm', async () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])
        mockRequestBottomSheet.mockResolvedValue('confirm')

        const { result } = renderHook(() => useSigningActionButtons())

        await act(async () => {
            result.current.handleSignAndSend()
        })

        await waitFor(() => {
            expect(mockNext).toHaveBeenCalledTimes(1)
        })
    })

    it('navigates to settings when guard resolves with go-to-settings', async () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])
        mockRequestBottomSheet.mockResolvedValue('go-to-settings')

        const { result } = renderHook(() => useSigningActionButtons())

        await act(async () => {
            result.current.handleSignAndSend()
        })

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('SecuritySettings')
        })
        expect(mockNext).not.toHaveBeenCalled()
    })

    it('does not call next when guard is dismissed', async () => {
        setupPipeline([
            { type: 'rekey', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])
        mockRequestBottomSheet.mockResolvedValue(undefined)

        const { result } = renderHook(() => useSigningActionButtons())

        await act(async () => {
            result.current.handleSignAndSend()
        })

        await waitFor(() => {
            expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        })

        expect(mockNext).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('does not trigger guard for close warnings only', () => {
        setupPipeline([
            { type: 'close', senderAddress: 'addr1', targetAddress: 'addr2' },
        ])

        const { result } = renderHook(() => useSigningActionButtons())

        act(() => {
            result.current.handleSignAndSend()
        })

        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockRequestBottomSheet).not.toHaveBeenCalled()
    })

    describe('signing_failed handling', () => {
        const showError = vi.fn()
        let capturedHandler: ((event: SigningPipelineEvent) => void) | undefined

        const setupPipelineCapturingHandler = (resolved: unknown): void => {
            ;(useSigningPipeline as Mock).mockImplementation(
                ({
                    onEvent,
                }: {
                    onEvent: (event: SigningPipelineEvent) => void
                }) => {
                    capturedHandler = onEvent
                    return {
                        currentRequest: mockRequest,
                        allTransactions: [],
                        warnings: [],
                        isLoading: false,
                        next: mockNext,
                        fail: mockFail,
                        resolved,
                    }
                },
            )
        }

        beforeEach(() => {
            capturedHandler = undefined
            showError.mockClear()
            ;(useErrorToast as Mock).mockReturnValue({ showError })
        })

        it('skips showError when the resolved signer is hardware', () => {
            setupPipelineCapturingHandler({
                signerType: 'hardware',
                transport: { kind: 'algod' },
                kind: { type: 'transactions' },
            })

            renderHook(() => useSigningActionButtons())

            act(() => {
                capturedHandler?.({
                    type: 'signing_failed',
                    error: new Error('boom'),
                } as SigningPipelineEvent)
            })

            expect(showError).not.toHaveBeenCalled()
        })

        it('calls showError when the resolved signer is a local key over algod', () => {
            setupPipelineCapturingHandler({
                signerType: 'localKey',
                transport: { kind: 'algod' },
                kind: { type: 'transactions' },
            })

            renderHook(() => useSigningActionButtons())

            act(() => {
                capturedHandler?.({
                    type: 'signing_failed',
                    error: new Error('boom'),
                } as SigningPipelineEvent)
            })

            expect(showError).toHaveBeenCalledOnce()
        })

        it('skips showError when transport is not algod (existing behavior preserved)', () => {
            setupPipelineCapturingHandler({
                signerType: 'localKey',
                transport: { kind: 'callback' },
                kind: { type: 'transactions' },
            })

            renderHook(() => useSigningActionButtons())

            act(() => {
                capturedHandler?.({
                    type: 'signing_failed',
                    error: new Error('boom'),
                } as SigningPipelineEvent)
            })

            expect(showError).not.toHaveBeenCalled()
        })
    })

    describe('unsignable multisig', () => {
        // The predicate itself (cosign exclusion, signer resolution, etc.) is
        // covered by isSignRequestMultisigUnsignable's own spec; here we only
        // check the hook wires it up and blocks the send when it's true.
        const request = { id: 'r1' }

        it('blocks an unsignable multisig and does not advance the pipeline', () => {
            ;(isSignRequestMultisigUnsignable as Mock).mockReturnValue(true)
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: request,
            })

            const { result } = renderHook(() => useSigningActionButtons())

            expect(result.current.isMultisigUnsignable).toBe(true)

            act(() => {
                result.current.handleSignAndSend()
            })

            expect(mockNext).not.toHaveBeenCalled()
        })

        it('does not block when the request is signable', () => {
            ;(isSignRequestMultisigUnsignable as Mock).mockReturnValue(false)
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: request,
            })

            const { result } = renderHook(() => useSigningActionButtons())

            expect(result.current.isMultisigUnsignable).toBe(false)
        })

        it('reports false when there is no current request', () => {
            ;(isSignRequestMultisigUnsignable as Mock).mockReturnValue(true)
            ;(useSigningRequest as Mock).mockReturnValue({
                currentRequest: undefined,
            })

            const { result } = renderHook(() => useSigningActionButtons())

            expect(result.current.isMultisigUnsignable).toBe(false)
        })
    })
})
