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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import type {
    ExecuteSwapResult,
    ExecuteSwapVariables,
    SwapExecutionFailure,
    SwapQuote,
} from '@perawallet/wallet-core-swaps'
import {
    NoConnectionError,
    PeraNetworkError,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    useSwapExecution,
    type SwapExecutionOutcome,
} from '../useSwapExecution'

const mockT = vi.fn((key: string) => key)
const mockExecuteSwap = vi.fn()
const mockResetMutation = vi.fn()
const mockUseIsQuantumSwapEnabled = vi.fn()

// The pipeline itself (preflights, group plans, signing, submission) is the
// swaps package's `executeSwap`, covered by its own spec. This hook only maps
// its results onto status and localized copy.
vi.mock('@perawallet/wallet-core-swaps', () => ({
    useExecuteSwapMutation: () => ({
        mutateAsync: mockExecuteSwap,
        reset: mockResetMutation,
    }),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    SubmissionError: class SubmissionError extends Error {
        readonly metadata = { retryable: true }
        constructor(
            readonly txIds: string[],
            readonly classification: string,
            readonly algodError: unknown,
        ) {
            super(`Submission ${classification}`)
        }
    },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => {
    class MockAlgodError extends Error {
        constructor(
            public readonly code: string,
            public readonly params: Record<string, unknown> = {},
            public readonly originalError?: Error,
        ) {
            super(`[algod:${code}] ${originalError?.message ?? code}`)
            this.name = 'AlgodError'
        }
    }
    return {
        microAlgosToAlgos: (microAlgos: { div: (n: number) => unknown }) =>
            microAlgos.div(1_000_000),
        AlgodError: MockAlgodError,
        toAlgodError: (err: unknown) =>
            new MockAlgodError(
                'unknown_node_error',
                { raw: err instanceof Error ? err.message : String(err) },
                err instanceof Error ? err : undefined,
            ),
    }
})

// The real formatter: the global setup stubs it, and the shortfall copy's
// display-unit formatting is under test here.
vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
}))

vi.mock('@hooks/useIsQuantumSwapEnabled', () => ({
    useIsQuantumSwapEnabled: () => mockUseIsQuantumSwapEnabled(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: mockT,
    }),
}))

const makeQuote = (quoteIdStr: string): SwapQuote =>
    ({ quoteIdStr }) as unknown as SwapQuote

const resolveWith = (result: ExecuteSwapResult) =>
    mockExecuteSwap.mockResolvedValue(result)

const failWith = (failure: SwapExecutionFailure) =>
    resolveWith({ kind: 'failed', failure })

const executeOnce = async (
    execute: (quote: SwapQuote) => Promise<SwapExecutionOutcome>,
): Promise<Optional<SwapExecutionOutcome>> => {
    let outcome: Optional<SwapExecutionOutcome>
    await act(async () => {
        outcome = await execute(makeQuote('quote-1'))
    })
    return outcome
}

// Holds the mutation open so a test can inspect the in-flight state.
const holdExecution = () => {
    let release: (result: ExecuteSwapResult) => void = () => {}
    let variables: Optional<ExecuteSwapVariables>
    mockExecuteSwap.mockImplementationOnce(
        (vars: ExecuteSwapVariables) =>
            new Promise<ExecuteSwapResult>(resolve => {
                variables = vars
                release = resolve
            }),
    )
    return {
        release: (result: ExecuteSwapResult) => release(result),
        variables: () => variables,
    }
}

describe('useSwapExecution', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseIsQuantumSwapEnabled.mockReturnValue(false)
        resolveWith({ kind: 'success', txIds: ['tx-1'] })
    })

    it('starts with idle status', () => {
        const { result } = renderHook(() => useSwapExecution())

        expect(result.current.status).toBe('idle')
        expect(result.current.error).toBeNull()
        expect(result.current.txIds).toEqual([])
    })

    it('runs the quote with localized signing copy and the quantum-swap flag', async () => {
        mockUseIsQuantumSwapEnabled.mockReturnValue(true)
        const { result } = renderHook(() => useSwapExecution())

        await executeOnce(result.current.execute)

        expect(mockExecuteSwap).toHaveBeenCalledWith({
            quote: makeQuote('quote-1'),
            isQuantumSwapEnabled: true,
            signingSource: {
                name: 'swap.signing.source_name',
                description: 'swap.signing.source_description',
            },
            onProgress: expect.any(Function),
            isCancelled: expect.any(Function),
        })
    })

    it('reports success with the submitted txIds', async () => {
        resolveWith({ kind: 'success', txIds: ['group-1-id', 'group-2-id'] })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({ kind: 'success' })
        expect(result.current.status).toBe('success')
        expect(result.current.txIds).toEqual(['group-1-id', 'group-2-id'])
    })

    it('mirrors each in-flight phase into status', async () => {
        const held = holdExecution()
        const { result } = renderHook(() => useSwapExecution())

        let outcomePromise: Optional<Promise<SwapExecutionOutcome>>
        act(() => {
            outcomePromise = result.current.execute(makeQuote('quote-1'))
        })

        // `isCancellable` in the confirmation sheet is `status === 'preparing'`.
        for (const phase of [
            'preparing',
            'signing',
            'submitting',
            'updating-status',
        ] as const) {
            act(() => {
                held.variables()?.onProgress(phase)
            })
            expect(result.current.status).toBe(phase)
        }

        await act(async () => {
            held.release({ kind: 'success', txIds: [] })
            await outcomePromise
        })
        expect(result.current.status).toBe('success')
    })

    it('abandons through cancel(): the execution sees the request and ends idle', async () => {
        const held = holdExecution()
        const { result } = renderHook(() => useSwapExecution())

        let outcomePromise: Optional<Promise<SwapExecutionOutcome>>
        act(() => {
            outcomePromise = result.current.execute(makeQuote('quote-cancel'))
        })
        act(() => {
            held.variables()?.onProgress('preparing')
        })
        expect(held.variables()?.isCancelled()).toBe(false)

        act(() => {
            result.current.cancel()
        })
        expect(held.variables()?.isCancelled()).toBe(true)

        let outcome: Optional<SwapExecutionOutcome>
        await act(async () => {
            held.release({ kind: 'cancelled' })
            outcome = await outcomePromise
        })

        expect(outcome).toEqual({ kind: 'cancelled' })
        expect(result.current.status).toBe('idle')
        expect(result.current.error).toBeNull()
    })

    it('clears a previous cancel request on the next execute', async () => {
        const { result } = renderHook(() => useSwapExecution())
        act(() => {
            result.current.cancel()
        })

        await executeOnce(result.current.execute)

        const vars = mockExecuteSwap.mock.calls[0][0] as ExecuteSwapVariables
        expect(vars.isCancelled()).toBe(false)
    })

    it('reports a stale quote as stale-quote and returns to idle', async () => {
        resolveWith({ kind: 'stale-quote' })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({ kind: 'stale-quote' })
        expect(result.current.status).toBe('idle')
    })

    it('reports an open earlier attempt as verifying', async () => {
        resolveWith({ kind: 'verifying-previous' })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({ kind: 'verifying-previous' })
        expect(result.current.status).toBe('verifying')
        expect(result.current.error).toBeNull()
    })

    it('reports a proposed shared-account swap as pending-cosign', async () => {
        resolveWith({ kind: 'pending-cosign' })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({ kind: 'pending-cosign' })
        expect(result.current.status).toBe('pending-cosign')
    })

    it('refuses a frozen holding with the shared AssetFrozenError copy', async () => {
        failWith({ phase: 'prepare', reason: 'asset-frozen', assetId: '0' })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        // Same keys the send path resolves, so the toast is titled "Asset
        // frozen" rather than the generic swap headline.
        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'errors.algod.asset_frozen.body',
            title: 'errors.algod.asset_frozen.title',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'prepare',
            message: 'errors.algod.asset_frozen.body',
        })
    })

    it('names the ALGO shortfall in display units', async () => {
        failWith({
            phase: 'prepare',
            reason: 'insufficient-algo',
            shortfall: new Decimal(5000),
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'swap.execution.insufficient_algo_body',
            title: 'swap.execution.insufficient_algo_title',
        })
        // The 5_000 µALGO shortfall reaches the copy in display units.
        expect(mockT).toHaveBeenCalledWith(
            'swap.execution.insufficient_algo_body',
            { amount: '0.005' },
        )
        expect(result.current.status).toBe('error')
    })

    it('maps an unrecognized prepare error to the general copy', async () => {
        failWith({
            phase: 'prepare',
            reason: 'prepare-failed',
            error: new Error('Prepare failed'),
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        // Never the algod "network rejected" fallback, which would blame the
        // node for a request that never reached it.
        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'errors.general.body',
            title: 'errors.general.title',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'prepare',
            message: 'errors.general.body',
        })
    })

    it('maps a backend prepare rejection to API copy, never the algod node fallback', async () => {
        failWith({
            phase: 'prepare',
            reason: 'prepare-failed',
            error: new PeraNetworkError('client', { status: 400 }),
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'errors.api.generic.body',
            title: 'errors.api.generic.title',
        })
    })

    it('maps an offline prepare failure to the no-connection copy', async () => {
        failWith({
            phase: 'prepare',
            reason: 'prepare-failed',
            error: new NoConnectionError(),
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome?.kind).toBe('error')
        if (outcome?.kind === 'error') {
            expect(outcome.phase).toBe('prepare')
            expect(outcome.message).toBe('errors.network.no_connection.body')
        }
        expect(result.current.error?.phase).toBe('prepare')
    })

    it('treats user rejection as a cancellation that still records the signing error', async () => {
        resolveWith({ kind: 'user-rejected' })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({ kind: 'cancelled' })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'signing',
            message: 'swap.execution.user_rejected',
        })
    })

    it('shows generic localized copy for a signing failure', async () => {
        failWith({ phase: 'signing', reason: 'signing-failed' })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'signing',
            message: 'swap.execution.error_body',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'signing',
            message: 'swap.execution.error_body',
        })
    })

    it('renders a quantum guard through its own i18n key', async () => {
        failWith({
            phase: 'signing',
            reason: 'quantum-blocked',
            translationKey: 'swap.execution.quantum_fee_unsupported',
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        // Must not collapse into the generic `swap.execution.error_body`.
        expect(outcome).toEqual({
            kind: 'error',
            phase: 'signing',
            message: 'swap.execution.quantum_fee_unsupported',
        })
        expect(result.current.error?.message).toBe(
            'swap.execution.quantum_fee_unsupported',
        )
    })

    it('carries the resolved title for a submission failure', async () => {
        failWith({
            phase: 'submission',
            reason: 'submission-failed',
            error: new Error('Submission failed'),
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome?.kind).toBe('error')
        if (outcome?.kind === 'error') {
            expect(outcome.phase).toBe('submission')
            // The toast headline must match the body instead of the caller
            // always rendering a hardcoded "Swap Failed".
            expect(outcome.title).toBe('errors.general.title')
        }
        expect(result.current.status).toBe('error')
        expect(result.current.error?.phase).toBe('submission')
    })

    it('reports an unverified submission as status-unknown rather than a node rejection', async () => {
        const { SubmissionError } =
            await import('@perawallet/wallet-core-signing')
        failWith({
            phase: 'submission',
            reason: 'submission-failed',
            error: new (SubmissionError as unknown as new (
                txIds: string[],
                classification: string,
                algodError: unknown,
            ) => Error)(
                ['TXID'],
                'unknown-outcome',
                new Error('network_unavailable'),
            ),
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(result.current.error?.message).toBe(
            'errors.submission.unknown_outcome.body',
        )
        if (outcome?.kind === 'error') {
            expect(outcome.title).toBe(
                'errors.submission.unknown_outcome.title',
            )
        }
    })

    it.each([
        [
            { phase: 'prepare', reason: 'missing-quote-id' } as const,
            'Swap quote is missing its id',
        ],
        [
            { phase: 'prepare', reason: 'no-transaction-groups' } as const,
            'No transaction groups returned',
        ],
        [
            { phase: 'prepare', reason: 'quote-mismatch' } as const,
            'swap.execution.error_body',
        ],
    ])('maps %o to its untitled message', async (failure, message) => {
        failWith(failure)
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({ kind: 'error', phase: 'prepare', message })
        expect(result.current.error).toEqual({ phase: 'prepare', message })
    })

    it('clears the previous error when a new execution starts', async () => {
        failWith({ phase: 'signing', reason: 'signing-failed' })
        const { result } = renderHook(() => useSwapExecution())
        await executeOnce(result.current.execute)
        expect(result.current.error).not.toBeNull()

        const held = holdExecution()
        let outcomePromise: Optional<Promise<SwapExecutionOutcome>>
        act(() => {
            outcomePromise = result.current.execute(makeQuote('quote-2'))
        })

        expect(result.current.error).toBeNull()

        await act(async () => {
            held.release({ kind: 'success', txIds: [] })
            await outcomePromise
        })
    })

    it('leaves status on the last phase when the execution throws', async () => {
        mockExecuteSwap.mockImplementationOnce(
            async (vars: ExecuteSwapVariables) => {
                vars.onProgress('preparing')
                throw new Error('decode failed')
            },
        )
        const { result } = renderHook(() => useSwapExecution())

        await act(async () => {
            await expect(
                result.current.execute(makeQuote('quote-throw')),
            ).rejects.toThrow('decode failed')
        })

        expect(result.current.status).toBe('preparing')
        expect(result.current.error).toBeNull()
    })

    it('resets state', async () => {
        failWith({
            phase: 'prepare',
            reason: 'prepare-failed',
            error: new Error('fail'),
        })
        const { result } = renderHook(() => useSwapExecution())
        await executeOnce(result.current.execute)
        expect(result.current.status).toBe('error')

        act(() => {
            result.current.reset()
        })

        expect(result.current.status).toBe('idle')
        expect(result.current.error).toBeNull()
        expect(result.current.txIds).toEqual([])
        expect(mockResetMutation).toHaveBeenCalled()
    })
})
