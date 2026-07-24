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

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import { renderHook, act } from '@testing-library/react'

import {
    mutationDefaults,
    NoConnectionError,
} from '@perawallet/wallet-core-shared'

// BigInt.prototype.microAlgo() is a runtime extension added by algokit-utils.
// Patch the prototype so `0n.microAlgo()` works in the test environment.
;(BigInt.prototype as unknown as { microAlgo: () => bigint }).microAlgo =
    function () {
        return this as unknown as bigint
    }

const mockPayment = vi.fn()
const mockGetSuggestedParams = vi.fn()
const mockAlgokit = {
    createTransaction: { payment: mockPayment },
    getSuggestedParams: mockGetSuggestedParams,
}

const mockAddSignRequest = vi.fn()
const mockEncodeSignedTransactions = vi.fn()
const mockSubmitAndAutoRefresh = vi.fn()
const mockUseAllAccounts = vi.fn()
const mockUseMinimumFeeConfig = vi.fn()
const mockResolveMinFeeForSender = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useAlgorandClient: () => mockAlgokit,
    useTransactionEncoder: () => ({
        encodeSignedTransactions: mockEncodeSignedTransactions,
    }),
    useMinimumFeeConfig: () => mockUseMinimumFeeConfig(),
    compactSignedResults: (signed: unknown[]) =>
        signed.filter(tx => tx !== null),
}))

// Full replacement (not importActual): the real barrels pull in
// platform-specific storage (react-native-mmkv) that can't load under
// vitest/jsdom. `resolveMinFeeForSender`'s own rekey-chain/PQ-multiplier
// correctness is already exhaustively covered by
// packages/signing/src/pipeline/sources/__tests__/minFeeResolver.spec.ts —
// these tests verify only that this hook wires the resolver's inputs
// correctly and applies the override guard on its output.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    useSigningRequest: () => ({ addSignRequest: mockAddSignRequest }),
    submitAndAutoRefresh: (...args: unknown[]) =>
        mockSubmitAndAutoRefresh(...args),
    resolveMinFeeForSender: (...args: unknown[]) =>
        mockResolveMinFeeForSender(...args),
}))

import { useSubmitRekeyMutation } from '../useSubmitRekeyMutation'
import { RekeyError } from '../../errors'

const SIGNING_METADATA = {
    name: 'Source account',
    description: 'Sign to rekey this account',
}

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
            // Mirror the production mutation policy (OFF-004): networkMode
            // 'always' so the mutationFn runs offline and rejects fast
            // instead of pausing/auto-resuming.
            mutations: { ...mutationDefaults, retry: false },
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
        mockGetSuggestedParams.mockResolvedValue({ minFee: 1000n })
        mockUseMinimumFeeConfig.mockReturnValue({
            minTxnFee: 1000n,
            pqMultiplier: 3n,
        })
        mockUseAllAccounts.mockReturnValue([])
        // Default: no PQ signer in the chain — resolver returns the base
        // fee, which must never force a staticFee override (regression).
        mockResolveMinFeeForSender.mockReturnValue(1000n)
    })

    afterEach(() => {
        // Prevent the forced-offline state from leaking into other tests.
        onlineManager.setOnline(true)
    })

    it('fails fast offline: rejects with build_failed before the signing pipeline opens', async () => {
        // OFF-004 hardening: when the device is offline, the mutation must
        // reject immediately — no Ledger/biometric prompt on a request that
        // can no way be submitted. assertOnline() runs BEFORE getSuggestedParams
        // and before requestRekeySignatures, so neither may be reached.
        onlineManager.setOnline(false)

        const { result } = renderHook(
            () => useSubmitRekeyMutation({ signingMetadata: SIGNING_METADATA }),
            { wrapper },
        )

        const rejection = result.current.submitAsync({
            sourceAddress: 'SRC',
            rekeyToAddress: 'TGT',
        })

        await expect(rejection).rejects.toBeInstanceOf(RekeyError)
        await expect(rejection).rejects.toMatchObject({
            reason: 'build_failed',
        })
        // The NoConnectionError is preserved as the wrapped cause.
        await rejection.catch((error: RekeyError) => {
            expect(error.originalError).toBeInstanceOf(NoConnectionError)
        })

        // The signing pipeline was NEVER invoked — the key guarantee.
        expect(mockAddSignRequest).not.toHaveBeenCalled()
        // assertOnline short-circuits before any network / build work.
        expect(mockGetSuggestedParams).not.toHaveBeenCalled()
        expect(mockPayment).not.toHaveBeenCalled()
        expect(mockSubmitAndAutoRefresh).not.toHaveBeenCalled()
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

        const { result } = renderHook(
            () => useSubmitRekeyMutation({ signingMetadata: SIGNING_METADATA }),
            {
                wrapper,
            },
        )

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

        const { result } = renderHook(
            () => useSubmitRekeyMutation({ signingMetadata: SIGNING_METADATA }),
            {
                wrapper,
            },
        )

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

        const { result } = renderHook(
            () => useSubmitRekeyMutation({ signingMetadata: SIGNING_METADATA }),
            {
                wrapper,
            },
        )

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

        const { result } = renderHook(
            () => useSubmitRekeyMutation({ signingMetadata: SIGNING_METADATA }),
            {
                wrapper,
            },
        )

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
            () => useSubmitRekeyMutation({ signingMetadata: SIGNING_METADATA }),
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

    it('overrides the fee with the PQ-resolved staticFee for a quantum sender', async () => {
        mockUseAllAccounts.mockReturnValue([
            { address: 'SRC', type: 'quantum' },
        ])
        // resolveMinFeeForSender (1000n base * 3n multiplier = 3000n) exceeds
        // the network's suggested minFee (1000n) and must be forced in.
        mockResolveMinFeeForSender.mockReturnValue(3000n)
        mockPayment
            .mockResolvedValueOnce({ id: 'draft', fee: 1000n })
            .mockResolvedValueOnce({ id: 'unsigned-txn' })
        mockAddSignRequest.mockImplementationOnce(
            (request: MockSignRequest) => {
                void request.approve?.([{ id: 'signed' }])
            },
        )
        mockSubmitAndAutoRefresh.mockResolvedValueOnce(['TX_ID'])

        const { result } = renderHook(
            () => useSubmitRekeyMutation({ signingMetadata: SIGNING_METADATA }),
            { wrapper },
        )

        await act(async () => {
            await result.current.submitAsync({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            })
        })

        // Sized from a fee-less draft first, then rebuilt with the override.
        expect(mockPayment).toHaveBeenCalledTimes(2)
        expect(mockPayment.mock.calls[0][0]).not.toHaveProperty('staticFee')
        expect(mockPayment.mock.calls[1][0]).toMatchObject({
            staticFee: 3000n,
        })
        expect(mockResolveMinFeeForSender).toHaveBeenCalledWith({
            senderAddress: 'SRC',
            accounts: [{ address: 'SRC', type: 'quantum' }],
            suggestedMinFee: 1000n,
            configMinTxnFee: 1000n,
            pqMultiplier: 3n,
        })
    })

    it('never forces a staticFee below the auto-sized built fee (congestion pricing)', async () => {
        // Per-byte congestion pricing: AlgoKit auto-sizes the built fee
        // above the PQ-resolved minimum — the override must not undercut
        // it, and display (max(resolved, built)) must match what is paid.
        mockResolveMinFeeForSender.mockReturnValue(1500n)
        mockPayment.mockResolvedValueOnce({ id: 'draft', fee: 2000n })
        mockAddSignRequest.mockImplementationOnce(
            (request: MockSignRequest) => {
                void request.approve?.([{ id: 'signed' }])
            },
        )
        mockSubmitAndAutoRefresh.mockResolvedValueOnce(['TX_ID'])

        const { result } = renderHook(
            () => useSubmitRekeyMutation({ signingMetadata: SIGNING_METADATA }),
            { wrapper },
        )

        await act(async () => {
            await result.current.submitAsync({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            })
        })

        // The auto-sized draft already pays enough — no rebuild, no override.
        expect(mockPayment).toHaveBeenCalledTimes(1)
        expect(mockPayment.mock.calls[0][0]).not.toHaveProperty('staticFee')
    })

    it('regression: builds without a staticFee key for an algo25 sender', async () => {
        mockUseAllAccounts.mockReturnValue([{ address: 'SRC', type: 'algo25' }])
        mockResolveMinFeeForSender.mockReturnValue(1000n)
        mockPayment.mockResolvedValueOnce({ id: 'unsigned-txn' })
        mockAddSignRequest.mockImplementationOnce(
            (request: MockSignRequest) => {
                void request.approve?.([{ id: 'signed' }])
            },
        )
        mockSubmitAndAutoRefresh.mockResolvedValueOnce(['TX_ID'])

        const { result } = renderHook(
            () => useSubmitRekeyMutation({ signingMetadata: SIGNING_METADATA }),
            { wrapper },
        )

        await act(async () => {
            await result.current.submitAsync({
                sourceAddress: 'SRC',
                rekeyToAddress: 'TGT',
            })
        })

        expect(mockPayment.mock.calls[0][0]).not.toHaveProperty('staticFee')
    })
})
