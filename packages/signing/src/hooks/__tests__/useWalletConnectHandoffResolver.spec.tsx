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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
    getSignRequestsWithSignatures: vi.fn(),
    classifyHandoffPoll: vi.fn(),
    resolveHandoffOutcome: vi.fn(),
    markConfirmed: vi.fn(),
    addSignature: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-multisig', () => ({
    addSignature: mocks.addSignature,
    getSignRequestsWithSignatures: mocks.getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey: (
        network: string,
        signRequestId: string,
    ) => ['multisig', 'sign-request-with-signatures', network, signRequestId],
    useMarkSignRequestsConfirmedMutation: () => ({
        markConfirmed: mocks.markConfirmed,
        isPending: false,
    }),
}))

// Stub the pure classifier + delivery functions so this suite verifies only
// the poll → classify → resolve wiring. Their own behavior is covered by
// classifyHandoffPoll.spec.ts.
vi.mock('../../pipeline/classifyHandoffPoll', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('../../pipeline/classifyHandoffPoll')
        >()
    return {
        ...actual,
        classifyHandoffPoll: mocks.classifyHandoffPoll,
        resolveHandoffOutcome: mocks.resolveHandoffOutcome,
    }
})

import { useWalletConnectHandoffResolver } from '../useWalletConnectHandoffResolver'
import { useWalletConnectHandoffsStore } from '../../store/walletConnectHandoffsStore'
import type { ResolverMessages } from '../../pipeline/classifyHandoffPoll'
import type { PendingWalletConnectHandoff } from '../../pipeline/walletConnectHandoffs'

const messages: ResolverMessages = {
    declined: 'multisig.sync_sign.errors.declined',
    expired: 'multisig.sync_sign.errors.expired',
    failed: 'multisig.sync_sign.errors.failed',
    noTransactions: 'multisig.sync_sign.errors.no_transactions',
    deliveryFailed: 'multisig.sync_sign.errors.delivery_failed',
    assemblyFailed: (reason: string) =>
        `multisig.sync_sign.errors.assembly_failed:${reason}`,
}

// Injected peer delivery — this suite stubs `resolveHandoffOutcome`, so these
// are pass-through no-ops that only satisfy the hook's required arg.
const delivery = {
    deliverResult: vi.fn().mockResolvedValue(undefined),
    deliverSoftReject: vi.fn().mockResolvedValue(undefined),
    deliverError: vi.fn().mockResolvedValue(undefined),
}

const makeHandoff = (signRequestId: string): PendingWalletConnectHandoff => ({
    signRequestId,
    multisigAddress: 'MSIG_ADDR',
    msigMetadata: { version: 1, threshold: 2, addresses: ['A', 'B', 'C'] },
    expectedRawTransactionsBase64: [btoa('raw-tx-1')],
    deviceId: 'device-1',
    network: 'testnet',
    callbacks: {},
    sourceType: 'walletconnect',
    registeredAt: Date.now(),
})

let queryClient: QueryClient

const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

describe('useWalletConnectHandoffResolver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useWalletConnectHandoffsStore.getState().resetState()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        mocks.getSignRequestsWithSignatures.mockResolvedValue([{ id: 'sr-1' }])
        mocks.classifyHandoffPoll.mockReturnValue({ kind: 'keep-polling' })
        mocks.resolveHandoffOutcome.mockResolvedValue(undefined)
    })

    afterEach(() => {
        queryClient.clear()
    })

    it('polls each registered handoff', async () => {
        mocks.getSignRequestsWithSignatures.mockImplementation(
            (
                _network: string,
                params: { proposed_sign_request_ids: string[] },
            ) => Promise.resolve([{ id: params.proposed_sign_request_ids[0] }]),
        )
        useWalletConnectHandoffsStore.getState().register(makeHandoff('sr-1'))
        useWalletConnectHandoffsStore.getState().register(makeHandoff('sr-2'))

        renderHook(
            () =>
                useWalletConnectHandoffResolver({
                    isAppActive: true,
                    messages,
                    delivery,
                }),
            { wrapper },
        )

        await waitFor(() => {
            const polledIds =
                mocks.getSignRequestsWithSignatures.mock.calls.map(
                    call => call[1].proposed_sign_request_ids[0],
                )
            expect(polledIds).toContain('sr-1')
            expect(polledIds).toContain('sr-2')
        })
    })

    it('delivers a terminal outcome to resolveHandoffOutcome', async () => {
        const outcome = { kind: 'soft-reject', reason: 'declined' }
        mocks.classifyHandoffPoll.mockReturnValue(outcome)
        const handoff = makeHandoff('sr-1')
        useWalletConnectHandoffsStore.getState().register(handoff)

        renderHook(
            () =>
                useWalletConnectHandoffResolver({
                    isAppActive: true,
                    messages,
                    delivery,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(1),
        )
        expect(mocks.resolveHandoffOutcome).toHaveBeenCalledWith({
            outcome,
            handoff,
            messages,
            delivery,
            markConfirmed: mocks.markConfirmed,
            cancelRequest: expect.any(Function),
        })
    })

    // The injected cancelRequest closure is the only thing that terminalizes
    // the proposer's backend record on a failed handoff (the inbox reads
    // backend status), so verify it wires the poll's proposer address through
    // to a 'declined' addSignature call.
    describe('cancelRequest closure', () => {
        const resolveArgsOf = (call: number) =>
            mocks.resolveHandoffOutcome.mock.calls[call][0] as {
                cancelRequest: () => Promise<void>
            }

        it('declines the proposer request read from the poll detail', async () => {
            mocks.getSignRequestsWithSignatures.mockResolvedValue([
                { id: 'sr-1', proposer_address: 'PROPOSER_ADDR' },
            ])
            mocks.classifyHandoffPoll.mockReturnValue({
                kind: 'error',
                reason: { kind: 'no-transactions' },
            })
            useWalletConnectHandoffsStore
                .getState()
                .register(makeHandoff('sr-1'))

            renderHook(
                () =>
                    useWalletConnectHandoffResolver({
                        isAppActive: true,
                        messages,
                        delivery,
                    }),
                { wrapper },
            )

            await waitFor(() =>
                expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(1),
            )

            await resolveArgsOf(0).cancelRequest()

            expect(mocks.addSignature).toHaveBeenCalledWith('testnet', 'sr-1', [
                {
                    address: 'PROPOSER_ADDR',
                    response: 'declined',
                    device_id: 'device-1',
                },
            ])
        })

        it('skips the decline when the poll never returned a proposer address', async () => {
            mocks.getSignRequestsWithSignatures.mockResolvedValue([
                { id: 'sr-1' },
            ])
            mocks.classifyHandoffPoll.mockReturnValue({
                kind: 'error',
                reason: { kind: 'no-transactions' },
            })
            useWalletConnectHandoffsStore
                .getState()
                .register(makeHandoff('sr-1'))

            renderHook(
                () =>
                    useWalletConnectHandoffResolver({
                        isAppActive: true,
                        messages,
                        delivery,
                    }),
                { wrapper },
            )

            await waitFor(() =>
                expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(1),
            )

            await resolveArgsOf(0).cancelRequest()

            expect(mocks.addSignature).not.toHaveBeenCalled()
        })
    })

    it('does not deliver while the poll says keep-polling', async () => {
        mocks.classifyHandoffPoll.mockReturnValue({ kind: 'keep-polling' })
        useWalletConnectHandoffsStore.getState().register(makeHandoff('sr-1'))

        renderHook(
            () =>
                useWalletConnectHandoffResolver({
                    isAppActive: true,
                    messages,
                    delivery,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(mocks.classifyHandoffPoll).toHaveBeenCalled(),
        )
        expect(mocks.resolveHandoffOutcome).not.toHaveBeenCalled()
    })

    it('does not poll while the app is backgrounded', async () => {
        useWalletConnectHandoffsStore.getState().register(makeHandoff('sr-1'))

        renderHook(
            () =>
                useWalletConnectHandoffResolver({
                    isAppActive: false,
                    messages,
                    delivery,
                }),
            { wrapper },
        )

        await new Promise(resolve => setTimeout(resolve, 20))
        expect(mocks.getSignRequestsWithSignatures).not.toHaveBeenCalled()
    })

    it('starts polling a handoff registered after mount', async () => {
        renderHook(
            () =>
                useWalletConnectHandoffResolver({
                    isAppActive: true,
                    messages,
                    delivery,
                }),
            { wrapper },
        )
        expect(mocks.getSignRequestsWithSignatures).not.toHaveBeenCalled()

        act(() => {
            useWalletConnectHandoffsStore
                .getState()
                .register(makeHandoff('sr-1'))
        })

        await waitFor(() =>
            expect(mocks.getSignRequestsWithSignatures).toHaveBeenCalled(),
        )
    })

    it('prunes resolved guard entries when their handoff leaves the registry', async () => {
        // Covers the resolvedRef pruning branch: after a terminal outcome is
        // delivered, the handoff stays in resolvedRef. When the registry
        // unregisters it, the next effect run must drop the stale entry so
        // a re-registration with the same id would be re-pollable.
        mocks.classifyHandoffPoll.mockReturnValue({
            kind: 'soft-reject',
            reason: 'declined',
        })
        const handoff = makeHandoff('sr-1')
        useWalletConnectHandoffsStore.getState().register(handoff)

        renderHook(
            () =>
                useWalletConnectHandoffResolver({
                    isAppActive: true,
                    messages,
                    delivery,
                }),
            { wrapper },
        )

        await waitFor(() =>
            expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(1),
        )

        // Unregister the handoff and confirm the effect re-runs without
        // re-delivering. The internal resolvedRef pruning path runs as
        // part of this effect re-run.
        act(() => {
            useWalletConnectHandoffsStore.getState().unregister('sr-1')
        })

        // Re-registering the SAME id after pruning must allow the resolver
        // to fire again (proving the stale guard was dropped).
        act(() => {
            useWalletConnectHandoffsStore
                .getState()
                .register(makeHandoff('sr-1'))
        })

        await waitFor(() =>
            expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(2),
        )
    })

    it('delivers each terminal outcome only once across repeated polls', async () => {
        mocks.classifyHandoffPoll.mockReturnValue({
            kind: 'soft-reject',
            reason: 'declined',
        })
        useWalletConnectHandoffsStore.getState().register(makeHandoff('sr-1'))
        vi.useFakeTimers()
        try {
            renderHook(
                () =>
                    useWalletConnectHandoffResolver({
                        isAppActive: true,
                        messages,
                    }),
                { wrapper },
            )

            await vi.waitFor(() =>
                expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(1),
            )

            // A second poll cycle must not re-deliver — the resolved guard holds.
            await vi.advanceTimersByTimeAsync(3000)
            expect(mocks.resolveHandoffOutcome).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })
})
