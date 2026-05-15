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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppState, type AppStateStatus } from 'react-native'
import {
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from '@perawallet/wallet-core-signing'

const {
    getSignRequestsWithSignaturesMock,
    markSignRequestsConfirmedMock,
    assembleMock,
    loggerWarnMock,
} = vi.hoisted(() => ({
    getSignRequestsWithSignaturesMock: vi.fn(),
    markSignRequestsConfirmedMock: vi.fn(),
    assembleMock: vi.fn(),
    loggerWarnMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-multisig', () => ({
    getSignRequestsWithSignatures: getSignRequestsWithSignaturesMock,
    markSignRequestsConfirmed: markSignRequestsConfirmedMock,
}))

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return { ...actual, assembleSignedMultisigTransactions: assembleMock }
})

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: loggerWarnMock,
            error: vi.fn(),
        },
    }
})

import {
    runOnePoll,
    startPolling,
    type ResolverContext,
} from '../resolveWalletConnectHandoff'

const SIGN_REQUEST_ID = 'sr-1'

const makeContext = (): ResolverContext => ({
    messages: {
        declined: 'msg.declined',
        expired: 'msg.expired',
        failed: 'msg.failed',
        noTransactions: 'msg.no_transactions',
        deliveryFailed: 'msg.delivery_failed',
        assemblyFailed: (reason: string) => `msg.assembly_failed:${reason}`,
    },
    resolved: new Set<string>(),
    timers: new Map<string, ReturnType<typeof setTimeout>>(),
})

const makeHandoff = (
    overrides: Partial<PendingWalletConnectHandoff> = {},
): PendingWalletConnectHandoff => ({
    signRequestId: SIGN_REQUEST_ID,
    multisigAddress: 'MSIG_ADDR',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B', 'C'] },
    deviceId: 'device-1',
    network: 'testnet',
    callbacks: {
        approveSignedBytes: vi.fn().mockResolvedValue(undefined),
        error: vi.fn().mockResolvedValue(undefined),
        softReject: vi.fn().mockResolvedValue(undefined),
    },
    source: { type: 'walletconnect' },
    registeredAt: Date.now(),
    ...overrides,
})

// Minimal `with-signatures` detail; cast since the test controls the mock
// directly (no Zod validation runs).
const makeDetail = (overrides: Record<string, unknown> = {}) =>
    ({
        id: SIGN_REQUEST_ID,
        status: 'ready',
        fail_reason_display: null,
        transaction_lists: [
            {
                raw_transactions: ['raw-tx-1'],
                responses: [
                    {
                        address: 'A',
                        response: 'signed',
                        signatures: ['sig-a'],
                    },
                ],
            },
        ],
        ...overrides,
    }) as Awaited<ReturnType<typeof getSignRequestsWithSignaturesMock>>

/**
 * Overrides the AppState the resolver reads. The resolver and this spec
 * import the same `react-native` module, so this mutates the object the
 * polling loop checks.
 */
const setAppState = (state: AppStateStatus): void => {
    const mutableAppState = AppState as { currentState: AppStateStatus }
    mutableAppState.currentState = state
}

describe('runOnePoll', () => {
    beforeEach(() => {
        walletConnectHandoffs.__resetForTests()
        getSignRequestsWithSignaturesMock.mockReset()
        markSignRequestsConfirmedMock.mockReset().mockResolvedValue(undefined)
        assembleMock.mockReset()
        loggerWarnMock.mockReset()
    })

    it('keeps polling (returns false) while status is pending', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({ status: 'pending' }),
        ])

        const shouldStop = await runOnePoll(handoff, makeContext())

        expect(shouldStop).toBe(false)
        expect(walletConnectHandoffs.get(SIGN_REQUEST_ID)).toBeDefined()
    })

    it('keeps polling when the response omits the polled sign request', async () => {
        const handoff = makeHandoff()
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({ id: 'other-request' }),
        ])

        expect(await runOnePoll(handoff, makeContext())).toBe(false)
    })

    it('delivers assembled bytes and marks confirmed on ready status', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([makeDetail()])
        const signedBytes = [new Uint8Array([1, 2, 3])]
        assembleMock.mockReturnValue({
            kind: 'success',
            signedTransactionsBytes: signedBytes,
        })

        const shouldStop = await runOnePoll(handoff, makeContext())

        expect(shouldStop).toBe(true)
        expect(handoff.callbacks.approveSignedBytes).toHaveBeenCalledWith(
            signedBytes,
        )
        expect(markSignRequestsConfirmedMock).toHaveBeenCalledWith('testnet', {
            device_id: 'device-1',
            proposed_sign_request_ids: [SIGN_REQUEST_ID],
        })
        expect(walletConnectHandoffs.get(SIGN_REQUEST_ID)).toBeUndefined()
    })

    it('still resolves successfully when mark-confirmed fails (non-fatal)', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([makeDetail()])
        assembleMock.mockReturnValue({
            kind: 'success',
            signedTransactionsBytes: [new Uint8Array([1])],
        })
        markSignRequestsConfirmedMock.mockRejectedValue(new Error('500'))

        const shouldStop = await runOnePoll(handoff, makeContext())

        expect(shouldStop).toBe(true)
        expect(handoff.callbacks.approveSignedBytes).toHaveBeenCalled()
        expect(handoff.callbacks.error).not.toHaveBeenCalled()
        expect(loggerWarnMock).toHaveBeenCalled()
    })

    it('keeps polling when a signed participant has no signatures yet', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({
                status: 'ready',
                transaction_lists: [
                    {
                        raw_transactions: ['raw-tx-1'],
                        responses: [
                            {
                                address: 'A',
                                response: 'signed',
                                signatures: [],
                            },
                        ],
                    },
                ],
            }),
        ])

        const shouldStop = await runOnePoll(handoff, makeContext())

        expect(shouldStop).toBe(false)
        expect(assembleMock).not.toHaveBeenCalled()
        expect(handoff.callbacks.approveSignedBytes).not.toHaveBeenCalled()
    })

    it('errors when a ready request carries no transaction lists', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({ status: 'ready', transaction_lists: [] }),
        ])

        const shouldStop = await runOnePoll(handoff, makeContext())

        expect(shouldStop).toBe(true)
        expect(handoff.callbacks.error).toHaveBeenCalledWith(
            new Error('msg.no_transactions'),
        )
    })

    it('errors when assembly fails', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([makeDetail()])
        assembleMock.mockReturnValue({ kind: 'error', reason: 'bad subsig' })

        const shouldStop = await runOnePoll(handoff, makeContext())

        expect(shouldStop).toBe(true)
        expect(handoff.callbacks.error).toHaveBeenCalledWith(
            new Error('msg.assembly_failed:bad subsig'),
        )
        // The terminal failure is logged for diagnostics.
        expect(loggerWarnMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                message: 'msg.assembly_failed:bad subsig',
            }),
        )
        expect(handoff.callbacks.approveSignedBytes).not.toHaveBeenCalled()
    })

    it('errors when delivering the signed bytes to the dApp fails', async () => {
        const handoff = makeHandoff()
        handoff.callbacks.approveSignedBytes = vi
            .fn()
            .mockRejectedValue(new Error('session dropped'))
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([makeDetail()])
        assembleMock.mockReturnValue({
            kind: 'success',
            signedTransactionsBytes: [new Uint8Array([1])],
        })

        const shouldStop = await runOnePoll(handoff, makeContext())

        expect(shouldStop).toBe(true)
        // The dApp gets the generic localized message, not the raw WC error.
        expect(handoff.callbacks.error).toHaveBeenCalledWith(
            new Error('msg.delivery_failed'),
        )
        // The raw error is kept for diagnostics.
        expect(loggerWarnMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ cause: 'session dropped' }),
        )
        expect(markSignRequestsConfirmedMock).not.toHaveBeenCalled()
    })

    it('soft-rejects (no error callback) on declined status', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({ status: 'declined' }),
        ])

        const shouldStop = await runOnePoll(handoff, makeContext())

        expect(shouldStop).toBe(true)
        expect(handoff.callbacks.softReject).toHaveBeenCalledWith(
            new Error('msg.declined'),
        )
        expect(handoff.callbacks.error).not.toHaveBeenCalled()
        expect(walletConnectHandoffs.get(SIGN_REQUEST_ID)).toBeUndefined()
    })

    it('soft-rejects on expired status', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({ status: 'expired' }),
        ])

        await runOnePoll(handoff, makeContext())

        expect(handoff.callbacks.softReject).toHaveBeenCalledWith(
            new Error('msg.expired'),
        )
        expect(handoff.callbacks.error).not.toHaveBeenCalled()
    })

    it('errors on failed status, preferring the backend fail reason', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({
                status: 'failed',
                fail_reason_display: 'insufficient funds',
            }),
        ])

        await runOnePoll(handoff, makeContext())

        expect(handoff.callbacks.error).toHaveBeenCalledWith(
            new Error('insufficient funds'),
        )
    })

    it('errors on failed status, falling back to the generic message', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({ status: 'failed', fail_reason_display: null }),
        ])

        await runOnePoll(handoff, makeContext())

        expect(handoff.callbacks.error).toHaveBeenCalledWith(
            new Error('msg.failed'),
        )
    })
})

describe('startPolling', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        setAppState('active')
        walletConnectHandoffs.__resetForTests()
        getSignRequestsWithSignaturesMock.mockReset()
        markSignRequestsConfirmedMock.mockReset().mockResolvedValue(undefined)
        assembleMock.mockReset()
        loggerWarnMock.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('polls immediately, then again after the base interval until terminal', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock
            .mockResolvedValueOnce([makeDetail({ status: 'pending' })])
            .mockResolvedValueOnce([makeDetail({ status: 'declined' })])

        startPolling(handoff, makeContext())
        // The first poll is scheduled at 0ms — advance to flush it.
        await vi.advanceTimersByTimeAsync(0)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(1)

        // Second poll after the 3s base interval reaches a terminal status.
        await vi.advanceTimersByTimeAsync(3000)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(2)
        expect(handoff.callbacks.softReject).toHaveBeenCalledTimes(1)

        // No further polls once resolved.
        await vi.advanceTimersByTimeAsync(10000)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(2)
    })

    it('logs and backs off exponentially on consecutive poll failures', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockRejectedValue(
            new Error('network down'),
        )

        startPolling(handoff, makeContext())
        await vi.advanceTimersByTimeAsync(0)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(1)
        expect(loggerWarnMock).toHaveBeenCalledTimes(1)

        // After 1 failure: retry scheduled at 3s * 2^1 = 6s.
        await vi.advanceTimersByTimeAsync(3000)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(3000)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(2)

        // After 2 failures: next retry at 3s * 2^2 = 12s.
        await vi.advanceTimersByTimeAsync(11000)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(2)
        await vi.advanceTimersByTimeAsync(1000)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(3)
    })

    it('stops polling when the handoff is unregistered externally', async () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({ status: 'pending' }),
        ])

        startPolling(handoff, makeContext())
        await vi.advanceTimersByTimeAsync(0)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(1)

        walletConnectHandoffs.unregister(SIGN_REQUEST_ID)
        await vi.advanceTimersByTimeAsync(10000)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(1)
    })

    it('claims the timer slot synchronously so it cannot double-start', () => {
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({ status: 'pending' }),
        ])
        const ctx = makeContext()

        startPolling(handoff, ctx)

        // The slot is taken before the first poll's async work runs, so a
        // concurrent resolver-hook effect re-run is deduped by `timers.has`.
        expect(ctx.timers.has(SIGN_REQUEST_ID)).toBe(true)
        expect(getSignRequestsWithSignaturesMock).not.toHaveBeenCalled()
    })

    it('skips polling while backgrounded, then resumes on foreground', async () => {
        setAppState('background')
        const handoff = makeHandoff()
        walletConnectHandoffs.register(handoff)
        getSignRequestsWithSignaturesMock.mockResolvedValue([
            makeDetail({ status: 'pending' }),
        ])

        startPolling(handoff, makeContext())
        await vi.advanceTimersByTimeAsync(0)
        // Backgrounded: the first tick must not hit the network.
        expect(getSignRequestsWithSignaturesMock).not.toHaveBeenCalled()

        // Still backgrounded one base interval later — still skipping.
        await vi.advanceTimersByTimeAsync(3000)
        expect(getSignRequestsWithSignaturesMock).not.toHaveBeenCalled()

        // Back in the foreground: the next tick polls.
        setAppState('active')
        await vi.advanceTimersByTimeAsync(3000)
        expect(getSignRequestsWithSignaturesMock).toHaveBeenCalledTimes(1)
    })
})
