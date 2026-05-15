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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'

// BigInt.prototype.microAlgo() is a runtime extension added by algokit-utils.
// Patch the prototype so `0n.microAlgo()` works in the test environment.
;(BigInt.prototype as unknown as { microAlgo: () => bigint }).microAlgo =
    function () {
        return this as unknown as bigint
    }

const mockPayment = vi.fn()
const mockAlgokit = {
    createTransaction: { payment: mockPayment },
}

const mockAddSignRequest = vi.fn()
const mockEncodeSignedTransactions = vi.fn()
const mockSubmitAndAutoRefresh = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => mockAlgokit,
    useTransactionEncoder: () => ({
        encodeSignedTransactions: mockEncodeSignedTransactions,
    }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
    submitAndAutoRefresh: (...args: unknown[]) =>
        mockSubmitAndAutoRefresh(...args),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

import { useSubmitRekeyMutation } from '../useSubmitRekeyMutation'
import { RekeyError } from '../../../utils/RekeyError'

type MockSignRequest = {
    txs: unknown[]
    headless?: boolean
    approve?: (signed: unknown[]) => void | Promise<void>
    reject?: () => void | Promise<void>
}

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })
    return React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
    )
}

describe('useSubmitRekeyMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('builds a 0-amount rekey payment, requests a signature, and submits the signed group', async () => {
        const unsignedTxn = { id: 'unsigned-txn' }
        const signedTxs = [{ id: 'signed-txn' }]
        const txIds = ['TX_ID_1']

        mockPayment.mockResolvedValueOnce(unsignedTxn)
        mockAddSignRequest.mockImplementationOnce(
            (request: MockSignRequest) => {
                void request.approve?.(signedTxs)
            },
        )
        mockSubmitAndAutoRefresh.mockResolvedValueOnce(txIds)

        const { result } = renderHook(() => useSubmitRekeyMutation(), {
            wrapper,
        })

        let returned: string[] | undefined
        await act(async () => {
            returned = await result.current.submitAsync({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            })
        })

        expect(mockPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                sender: 'SRC',
                receiver: 'SRC',
                rekeyTo: 'TGT',
            }),
        )
        // No explicit fee — AlgoKit sizes it from the encoded transaction.
        expect(mockPayment.mock.calls[0][0]).not.toHaveProperty('staticFee')
        expect(mockAddSignRequest).toHaveBeenCalledTimes(1)
        const request = mockAddSignRequest.mock.calls[0][0]
        expect(request.txs).toEqual([unsignedTxn])
        expect(request.sourceType).toBe('local')
        expect(mockSubmitAndAutoRefresh).toHaveBeenCalledWith(
            mockAlgokit,
            mockEncodeSignedTransactions,
            signedTxs,
        )
        expect(returned).toEqual(txIds)
    })

    it('rejects with a user_rejected RekeyError when the signing pipeline rejects', async () => {
        mockPayment.mockResolvedValueOnce({ id: 'unsigned-txn' })
        mockAddSignRequest.mockImplementationOnce(
            (request: MockSignRequest) => {
                void request.reject?.()
            },
        )

        const { result } = renderHook(() => useSubmitRekeyMutation(), {
            wrapper,
        })

        await expect(
            result.current.submitAsync({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            }),
        ).rejects.toMatchObject({ reason: 'user_rejected' })
        expect(mockSubmitAndAutoRefresh).not.toHaveBeenCalled()
    })

    it('wraps a failed payment build in a build_failed RekeyError', async () => {
        const buildError = new Error('cannot build payment')
        mockPayment.mockRejectedValueOnce(buildError)

        const { result } = renderHook(() => useSubmitRekeyMutation(), {
            wrapper,
        })

        await expect(
            result.current.submitAsync({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            }),
        ).rejects.toMatchObject({
            reason: 'build_failed',
            originalError: buildError,
        })
        expect(mockAddSignRequest).not.toHaveBeenCalled()
    })

    it('wraps algod submission errors in a submission_failed RekeyError', async () => {
        const algodError = new Error('algod unreachable')
        mockPayment.mockResolvedValueOnce({ id: 'unsigned-txn' })
        mockAddSignRequest.mockImplementationOnce(
            (request: MockSignRequest) => {
                void request.approve?.([{ id: 'signed' }])
            },
        )
        mockSubmitAndAutoRefresh.mockRejectedValueOnce(algodError)

        const { result } = renderHook(() => useSubmitRekeyMutation(), {
            wrapper,
        })

        const rejection = result.current.submitAsync({
            sourceAddress: 'SRC',
            rekeyToAddress: 'TGT',
        })
        await expect(rejection).rejects.toBeInstanceOf(RekeyError)
        await expect(rejection).rejects.toMatchObject({
            reason: 'submission_failed',
            originalError: algodError,
        })
    })

    it('opts out of throwOnError so signing failures do not crash the confirm screen', async () => {
        // Mirrors the production QueryProvider, where mutations default to
        // throwOnError: true so unhandled errors surface to ErrorBoundary.
        // useSubmitRekeyMutation overrides this because every caller handles
        // signing failures locally via try/catch + showError. Without the
        // override, a Ledger timeout would render-error the confirm screen
        // on the next re-render even after the consumer's catch block had
        // already shown a toast.
        const productionLikeWrapper = ({
            children,
        }: {
            children: React.ReactNode
        }) => {
            const queryClient = new QueryClient({
                defaultOptions: {
                    queries: { retry: false },
                    mutations: { retry: false, throwOnError: true },
                },
            })
            return React.createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
        }

        const ledgerTimeout = new Error(
            'Connect to Ledger timed out after 10000ms',
        )
        mockPayment.mockResolvedValueOnce({ id: 'unsigned-txn' })
        mockAddSignRequest.mockImplementationOnce(
            (request: MockSignRequest) => {
                void (
                    request as MockSignRequest & {
                        error?: (err: Error) => void | Promise<void>
                    }
                ).error?.(ledgerTimeout)
            },
        )

        const { result, rerender } = renderHook(
            () => useSubmitRekeyMutation(),
            { wrapper: productionLikeWrapper },
        )

        // Consumer awaits and catches — mirrors useUndoRekeyConfirmScreen.submit().
        await act(async () => {
            await expect(
                result.current.submitAsync({
                    sourceAddress: 'SRC',
                    rekeyToAddress: 'TGT',
                }),
            ).rejects.toMatchObject({
                reason: 'signing_failed',
                originalError: ledgerTimeout,
            })
        })

        // Re-render the hook. With throwOnError: true (the global default),
        // useMutation would re-throw the error during render here, crashing
        // the screen. The local override must prevent this.
        expect(() => rerender()).not.toThrow()
    })
})
