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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
const mockCreateQuotes = vi.fn()

// The pipeline itself (preflights, group plans, signing, submission) is the
// swaps package's `executeSwap`, covered by its own spec. This hook only maps
// its results onto status and localized copy.
vi.mock('@perawallet/wallet-core-swaps', async () => ({
    SwapAccountUnsupportedError: class SwapAccountUnsupportedError extends Error {},
    SwapCosignUnsupportedError: class SwapCosignUnsupportedError extends Error {},
    useExecuteSwapMutation: () => ({
        mutateAsync: mockExecuteSwap,
        reset: mockResetMutation,
    }),
    useCreateQuotesMutation: () => ({ mutateAsync: mockCreateQuotes }),
    // Pure helpers, imported by path so the factory stays free of the package's
    // hooks and stores.
    ...(await vi.importActual<
        typeof import('@packages/swaps/src/utils/quoteFreshness')
    >('@packages/swaps/src/utils/quoteFreshness')),
    ...(await vi.importActual<
        typeof import('@packages/swaps/src/utils/routerErrors')
    >('@packages/swaps/src/utils/routerErrors')),
    ...(await vi.importActual<
        typeof import('@packages/swaps/src/execution/failureStep')
    >('@packages/swaps/src/execution/failureStep')),
}))

vi.mock('@perawallet/wallet-core-signing', () => ({
    TransportError: class TransportError extends Error {},
    UserRejectedSigningError: class UserRejectedSigningError extends Error {},
    SubmissionError: class SubmissionError extends Error {
        readonly metadata = { retryable: true }
        constructor(
            readonly txIds: string[],
            readonly classification: string,
            readonly nodeError: unknown,
        ) {
            super(`Submission ${classification}`)
        }
    },
}))

vi.mock('@perawallet/wallet-core-chain-algorand/blockchain', () => {
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

vi.mock('@perawallet/wallet-core-assets', () => ({
    nativeAssetFor: (chainId: string) =>
        chainId === 'algorand'
            ? { assetId: '0', unitName: 'ALGO', decimals: 6 }
            : { assetId: 'native', unitName: 'ETH', decimals: 18 },
}))

const { mockTxError, mockTxSuccess } = vi.hoisted(() => ({
    mockTxError: vi.fn(),
    mockTxSuccess: vi.fn(),
}))

vi.mock('@hooks/useHaptics', () => ({
    useHaptics: () => ({ txError: mockTxError, txSuccess: mockTxSuccess }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: mockT,
    }),
}))

const makeQuote = (quoteId: string, overrides: Partial<SwapQuote> = {}) =>
    ({
        quoteId,
        provider: 'xo',
        request: { sourceAddress: 'SENDER' },
        amountOut: new Decimal('1000'),
        minimumAmountOut: new Decimal('990'),
        fetchedAt: Date.now(),
        expiresAt: null,
        ...overrides,
    }) as unknown as SwapQuote

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

const nodeError = Object.assign(new Error('node'), { code: 'node_error' })

describe('useSwapExecution', () => {
    // Only Date is frozen: two quotes with one id compare equal, and a slow
    // worker can't age a fixture into the re-quote margin mid-file.
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.clearAllMocks()
        mockCreateQuotes.mockResolvedValue([])
        resolveWith({ kind: 'success', orderId: '1', txIds: ['tx-1'] })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts with idle status', () => {
        const { result } = renderHook(() => useSwapExecution())

        expect(result.current.status).toBe('idle')
        expect(result.current.error).toBeNull()
        expect(result.current.txIds).toEqual([])
    })

    describe('readying the destination first', () => {
        const run = async (
            prepareDestination: () => Promise<boolean>,
            current: {
                execute: ReturnType<typeof useSwapExecution>['execute']
            },
        ) => {
            let outcome: Optional<SwapExecutionOutcome>
            await act(async () => {
                outcome = await current.execute(
                    makeQuote('quote-1'),
                    prepareDestination,
                )
            })
            return outcome
        }

        it('runs the swap once the destination is ready', async () => {
            const { result } = renderHook(() => useSwapExecution())

            const outcome = await run(async () => true, result.current)

            expect(mockExecuteSwap).toHaveBeenCalledOnce()
            expect(outcome).toEqual({ kind: 'success' })
        })

        it('creates no order when the user declines', async () => {
            const { result } = renderHook(() => useSwapExecution())

            const outcome = await run(async () => false, result.current)

            expect(mockExecuteSwap).not.toHaveBeenCalled()
            expect(outcome).toEqual({ kind: 'cancelled' })
            expect(result.current.status).toBe('idle')
        })

        it('creates no order when the sheet closed meanwhile', async () => {
            const { result } = renderHook(() => useSwapExecution())

            const outcome = await run(async () => {
                result.current.cancel()
                return true
            }, result.current)

            expect(mockExecuteSwap).not.toHaveBeenCalled()
            expect(outcome).toEqual({ kind: 'cancelled' })
        })

        it('fails in the prepare phase when it throws, with no order', async () => {
            const { result } = renderHook(() => useSwapExecution())

            const outcome = await run(async () => {
                throw new Error('attestation missing')
            }, result.current)

            expect(mockExecuteSwap).not.toHaveBeenCalled()
            expect(outcome).toMatchObject({ kind: 'error', phase: 'prepare' })
            expect(result.current.status).toBe('error')
        })
    })

    it('runs the quote with localized signing copy', async () => {
        const { result } = renderHook(() => useSwapExecution())

        await executeOnce(result.current.execute)

        expect(mockExecuteSwap).toHaveBeenCalledWith({
            quote: makeQuote('quote-1'),
            signingSource: {
                name: 'swap.signing.source_name',
                description: 'swap.signing.source_description',
            },
            onProgress: expect.any(Function),
            isCancelled: expect.any(Function),
        })
    })

    it('reports success with the submitted txIds', async () => {
        resolveWith({
            kind: 'success',
            orderId: '1',
            txIds: ['group-1-id', 'group-2-id'],
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({ kind: 'success' })
        expect(result.current.status).toBe('success')
        expect(result.current.txIds).toEqual(['group-1-id', 'group-2-id'])
    })

    describe('haptics', () => {
        const failedSubmission = (error: unknown) =>
            failWith({
                phase: 'submission',
                reason: 'submission-failed',
                error,
            })

        it('leaves the success haptic to the UI that shows the result', async () => {
            resolveWith({
                kind: 'success',
                orderId: '1',
                txIds: ['approve-id', 'swap-id'],
            })
            const { result } = renderHook(() => useSwapExecution())

            await executeOnce(result.current.execute)

            expect(mockTxSuccess).not.toHaveBeenCalled()
            expect(mockTxError).not.toHaveBeenCalled()
        })

        it('plays txError when the node rejected the submission', async () => {
            const { SubmissionError } =
                await import('@perawallet/wallet-core-signing')
            failedSubmission(
                new SubmissionError(['t1'], 'rejected-by-node', nodeError),
            )
            const { result } = renderHook(() => useSwapExecution())

            await executeOnce(result.current.execute)

            expect(mockTxError).toHaveBeenCalledTimes(1)
        })

        it('stays silent when no node answered, since the swap may still land', async () => {
            const { SubmissionError } =
                await import('@perawallet/wallet-core-signing')
            failedSubmission(
                new SubmissionError(['t1'], 'unknown-outcome', nodeError),
            )
            const { result } = renderHook(() => useSwapExecution())

            await executeOnce(result.current.execute)

            expect(mockTxError).not.toHaveBeenCalled()
            expect(mockTxSuccess).not.toHaveBeenCalled()
        })

        it('plays txError for a transaction that reverted', async () => {
            failWith({
                phase: 'submission',
                reason: 'reverted',
                error: new Error('reverted'),
            })
            const { result } = renderHook(() => useSwapExecution())

            await executeOnce(result.current.execute)

            expect(mockTxError).toHaveBeenCalledTimes(1)
        })

        it('plays txError for a submission that never reached the network or timed out', async () => {
            const { TransportError } =
                await import('@perawallet/wallet-core-signing')
            failedSubmission(new TransportError('ledger unreadable'))
            const { result } = renderHook(() => useSwapExecution())
            await executeOnce(result.current.execute)

            failedSubmission(new Error('receipt wait timed out'))
            await executeOnce(result.current.execute)

            expect(mockTxError).toHaveBeenCalledTimes(2)
        })

        it.each<[string, ExecuteSwapResult]>([
            [
                'a signing failure',
                {
                    kind: 'failed',
                    failure: { phase: 'signing', reason: 'signing-failed' },
                },
            ],
            [
                'a prepare failure',
                {
                    kind: 'failed',
                    failure: { phase: 'prepare', reason: 'no-signable-steps' },
                },
            ],
        ])('plays txError with the error shown for %s', async (_, outcome) => {
            resolveWith(outcome)
            const { result } = renderHook(() => useSwapExecution())

            await executeOnce(result.current.execute)

            expect(mockTxError).toHaveBeenCalledTimes(1)
        })

        it.each<[string, ExecuteSwapResult]>([
            ['a user rejection', { kind: 'user-rejected' }],
            ['a cancel', { kind: 'cancelled' }],
            ['a proposed shared-account swap', { kind: 'pending-cosign' }],
            ['a stale quote', { kind: 'stale-quote' }],
            ['an open earlier attempt', { kind: 'verifying-previous' }],
        ])('plays no transaction haptic for %s', async (_, outcome) => {
            resolveWith(outcome)
            const { result } = renderHook(() => useSwapExecution())

            await executeOnce(result.current.execute)

            expect(mockTxError).not.toHaveBeenCalled()
        })
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
            held.release({ kind: 'success', orderId: '1', txIds: [] })
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

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'errors.transaction.asset_frozen.body',
            title: 'swap.execution.failed_title.prepare',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'prepare',
            message: 'errors.transaction.asset_frozen.body',
        })
    })

    it("names the shortfall in the chain's native asset, in display units", async () => {
        failWith({
            phase: 'prepare',
            reason: 'insufficient-native-balance',
            chainId: 'algorand',
            shortfall: new Decimal(5000),
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'swap.execution.insufficient_native_body',
            title: 'swap.execution.failed_title.prepare',
        })
        // The 5_000 µALGO shortfall reaches the copy in display units.
        expect(mockT).toHaveBeenCalledWith(
            'swap.execution.insufficient_native_body',
            { amount: '0.005', symbol: 'ALGO' },
        )
        expect(result.current.status).toBe('error')
    })

    it("uses the failing chain's own symbol and decimals", async () => {
        failWith({
            phase: 'prepare',
            reason: 'insufficient-native-balance',
            chainId: 'ethereum',
            shortfall: new Decimal('2000000000000000'),
        })
        const { result } = renderHook(() => useSwapExecution())

        await executeOnce(result.current.execute)

        expect(mockT).toHaveBeenCalledWith(
            'swap.execution.insufficient_native_body',
            { amount: '0.002', symbol: 'ETH' },
        )
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
            title: 'swap.execution.failed_title.prepare',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'prepare',
            message: 'errors.general.body',
        })
    })

    it.each([
        ['an uncoded 4xx', new PeraNetworkError('client', { status: 400 })],
        [
            'a declined order',
            new PeraNetworkError('client', {
                status: 422,
                backendCode: 'order_rejected',
            }),
        ],
    ])('points %s at another provider', async (_label, error) => {
        failWith({ phase: 'prepare', reason: 'prepare-failed', error })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'swap.execution.provider_failed_body',
            title: 'swap.execution.failed_title.prepare',
        })
        expect(result.current.error).toEqual({
            phase: 'prepare',
            message: 'swap.execution.provider_failed_body',
        })
    })

    it.each([
        [
            'an uncoded 5xx',
            new PeraNetworkError('server', { status: 502 }),
            'swap.execution.provider_unavailable_body',
        ],
        [
            'a rate-limited upstream',
            new PeraNetworkError('client', {
                status: 429,
                backendCode: 'upstream_rate_limited',
            }),
            'swap.execution.provider_unavailable_body',
        ],
        [
            'an order the balance cannot cover',
            new PeraNetworkError('client', {
                status: 422,
                backendCode: 'insufficient_balance',
            }),
            'swap.execution.order_insufficient_balance_body',
        ],
    ])('names what to do about %s', async (_label, error, message) => {
        failWith({ phase: 'prepare', reason: 'prepare-failed', error })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message,
            title: 'swap.execution.failed_title.prepare',
        })
    })

    it('keeps the timeout copy for a prepare that never got an answer', async () => {
        failWith({
            phase: 'prepare',
            reason: 'prepare-failed',
            error: new PeraNetworkError('timeout'),
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'errors.network.timeout.body',
            title: 'swap.execution.failed_title.prepare',
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

    it('says a signing failure sent nothing, under the failing step', async () => {
        failWith({
            phase: 'signing',
            reason: 'signing-failed',
            step: 'approval',
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'signing',
            message: 'swap.execution.signing_failed_body',
            title: 'swap.execution.failed_title.approval',
        })
        expect(result.current.status).toBe('error')
        expect(result.current.error).toEqual({
            phase: 'signing',
            message: 'swap.execution.signing_failed_body',
        })
    })

    it('renders a quantum guard through its own i18n key', async () => {
        failWith({
            phase: 'signing',
            reason: 'quantum-blocked',
            translationKey: i18nKey('swap.execution.quantum_fee_unsupported'),
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'signing',
            message: 'swap.execution.quantum_fee_unsupported',
            title: 'swap.execution.failed_title.swap',
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
            expect(outcome.title).toBe('swap.execution.failed_title.swap')
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
                nodeError: unknown,
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

    it('names the swap step for a reverted swap and the approval step for a reverted approval', async () => {
        const { result } = renderHook(() => useSwapExecution())

        failWith({
            phase: 'submission',
            reason: 'reverted',
            error: new Error('reverted'),
            step: 'approval',
        })
        const approval = await executeOnce(result.current.execute)
        failWith({
            phase: 'submission',
            reason: 'reverted',
            error: new Error('reverted'),
            step: 'swap',
        })
        const swap = await executeOnce(result.current.execute)

        expect(approval).toMatchObject({
            title: 'swap.execution.failed_title.approval',
        })
        expect(swap).toMatchObject({
            title: 'swap.execution.failed_title.swap',
        })
    })

    it('says why an unverified route could not run, naming the network', async () => {
        failWith({
            phase: 'prepare',
            reason: 'route-unverified',
            chainId: 'ethereum',
        })
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message: 'swap.execution.route_unverified_body',
            title: 'swap.execution.failed_title.prepare',
        })
        expect(mockT).toHaveBeenCalledWith(
            'swap.execution.route_unverified_body',
            { network: expect.any(String) },
        )
    })

    it.each([
        [
            { phase: 'prepare', reason: 'no-signable-steps' } as const,
            'swap.execution.unsupported_order_body',
        ],
        [
            { phase: 'prepare', reason: 'unsupported-steps' } as const,
            'swap.execution.unsupported_order_body',
        ],
        [
            { phase: 'prepare', reason: 'quote-mismatch' } as const,
            'swap.execution.quote_mismatch_body',
        ],
    ])('maps %o to its message', async (failure, message) => {
        failWith(failure)
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual({
            kind: 'error',
            phase: 'prepare',
            message,
            title: 'swap.execution.failed_title.prepare',
        })
        expect(result.current.error).toEqual({ phase: 'prepare', message })
    })

    describe('re-pricing a quote that is about to lapse', () => {
        const nearlyExpired = () =>
            makeQuote('quote-old', { fetchedAt: Date.now() - 50_000 })
        const offer = (quoteId: string, overrides: Partial<SwapQuote> = {}) =>
            makeQuote(quoteId, { fetchedAt: Date.now(), ...overrides })

        const run = async (
            current: {
                execute: ReturnType<typeof useSwapExecution>['execute']
            },
            quote: SwapQuote,
        ) => {
            let outcome: Optional<SwapExecutionOutcome>
            await act(async () => {
                outcome = await current.execute(quote)
            })
            return outcome
        }

        it("runs the same provider's fresh offer when its floor holds", async () => {
            const fresh = offer('quote-new')
            mockCreateQuotes.mockResolvedValue([fresh])
            const { result } = renderHook(() => useSwapExecution())

            const outcome = await run(result.current, nearlyExpired())

            expect(mockCreateQuotes).toHaveBeenCalledWith(
                nearlyExpired().request,
            )
            expect(mockExecuteSwap).toHaveBeenCalledWith(
                expect.objectContaining({ quote: fresh }),
            )
            expect(outcome).toEqual({ kind: 'success' })
        })

        it('does not re-quote a quote with life left', async () => {
            const { result } = renderHook(() => useSwapExecution())

            await run(
                result.current,
                makeQuote('quote-1', { fetchedAt: Date.now() - 30_000 }),
            )

            expect(mockCreateQuotes).not.toHaveBeenCalled()
            expect(mockExecuteSwap).toHaveBeenCalledOnce()
        })

        it('asks for a fresh confirm when the new floor is below the confirmed one', async () => {
            mockCreateQuotes.mockResolvedValue([
                offer('quote-new', {
                    amountOut: new Decimal('1100'),
                    minimumAmountOut: new Decimal('980'),
                }),
            ])
            const { result } = renderHook(() => useSwapExecution())

            const outcome = await run(result.current, nearlyExpired())

            expect(outcome).toEqual({ kind: 'stale-quote' })
            expect(mockExecuteSwap).not.toHaveBeenCalled()
            expect(result.current.status).toBe('idle')
        })

        it('asks for a fresh confirm when the re-quote fails', async () => {
            mockCreateQuotes.mockRejectedValue(new Error('offline'))
            const { result } = renderHook(() => useSwapExecution())

            const outcome = await run(result.current, nearlyExpired())

            expect(outcome).toEqual({ kind: 'stale-quote' })
            expect(mockExecuteSwap).not.toHaveBeenCalled()
        })

        it('abandons the swap when the sheet closes during the re-quote', async () => {
            const { result } = renderHook(() => useSwapExecution())
            mockCreateQuotes.mockImplementation(async () => {
                result.current.cancel()
                return [offer('quote-new')]
            })

            const outcome = await run(result.current, nearlyExpired())

            expect(outcome).toEqual({ kind: 'cancelled' })
            expect(mockExecuteSwap).not.toHaveBeenCalled()
            expect(result.current.status).toBe('idle')
        })
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
            held.release({ kind: 'success', orderId: '1', txIds: [] })
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

    it('reports a swap the account cannot run as an error, not a rejection', async () => {
        const { SwapAccountUnsupportedError } =
            await import('@perawallet/wallet-core-swaps')
        mockExecuteSwap.mockRejectedValueOnce(new SwapAccountUnsupportedError())
        const { result } = renderHook(() => useSwapExecution())

        const outcome = await executeOnce(result.current.execute)

        expect(outcome).toEqual(
            expect.objectContaining({
                kind: 'error',
                phase: 'prepare',
                title: 'swap.execution.failed_title.prepare',
            }),
        )
        expect(result.current.status).toBe('error')
        expect(mockTxError).toHaveBeenCalledTimes(1)
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
