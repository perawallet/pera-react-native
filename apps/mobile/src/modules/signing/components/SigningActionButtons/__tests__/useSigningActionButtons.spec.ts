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
    useSigningPipeline,
    useSigningRequest,
    type TransactionWarning,
    type SigningPipelineEvent,
} from '@perawallet/wallet-core-signing'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useNavigation } from '@react-navigation/native'
import { useErrorToast } from '@hooks/useErrorToast'
import { useBottomSheet } from '@modules/bottom-sheet'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningPipeline: vi.fn(),
    useSigningRequest: vi.fn(),
    isTransactionRequest: vi.fn(() => false),
    resolveSignerAddress: vi.fn((req: { txs?: { sender?: unknown }[] }) => {
        const sender = req?.txs?.[0]?.sender as
            | { toString?: () => string }
            | string
            | undefined
        if (!sender) return undefined
        if (typeof sender === 'string') return sender
        return sender.toString?.()
    }),
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
        const HW_ADDR = 'HW_ADDR'
        const LOCAL_ADDR = 'LOCAL_ADDR'

        const hwAccount = {
            type: 'hardware',
            address: HW_ADDR,
            hardwareDetails: {
                manufacturer: 'ledger',
                deviceId: 'd1',
                deviceName: 'Nano X',
                accountIndex: 0,
                transportType: 'ble',
            },
        } as never

        const localAccount = {
            type: 'algo25',
            address: LOCAL_ADDR,
            keyPairId: 'kp1',
        } as never

        const showError = vi.fn()
        let capturedHandler: ((event: SigningPipelineEvent) => void) | undefined

        const setupPipelineCapturingHandler = (
            currentRequest: unknown,
        ): void => {
            ;(useSigningPipeline as Mock).mockImplementation(
                ({
                    onEvent,
                }: {
                    onEvent: (event: SigningPipelineEvent) => void
                }) => {
                    capturedHandler = onEvent
                    return {
                        currentRequest,
                        allTransactions: [],
                        warnings: [],
                        isLoading: false,
                        next: mockNext,
                        fail: mockFail,
                    }
                },
            )
        }

        beforeEach(() => {
            capturedHandler = undefined
            showError.mockClear()
            ;(useErrorToast as Mock).mockReturnValue({ showError })
            ;(useAllAccounts as Mock).mockReturnValue([hwAccount, localAccount])
            // `isHardwareWalletAccount` is globally mocked in vitest.setup.ts
            // to return true when `account.type === 'hardware'`, which matches
            // the `hwAccount` fixture above. No per-test override is needed.
        })

        it('skips showError when the failed request is for a hardware account', () => {
            setupPipelineCapturingHandler({
                id: 'r1',
                transport: 'algod',
                txs: [{ sender: { toString: () => HW_ADDR } }],
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

        it('calls showError when the failed request is for a local-key account', () => {
            setupPipelineCapturingHandler({
                id: 'r2',
                transport: 'algod',
                txs: [{ sender: { toString: () => LOCAL_ADDR } }],
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
                id: 'r3',
                transport: 'walletconnect',
                txs: [{ sender: { toString: () => LOCAL_ADDR } }],
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
})
