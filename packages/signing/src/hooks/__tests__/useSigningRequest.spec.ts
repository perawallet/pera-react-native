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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { useSigningRequest } from '../useSigningRequest'
import { SigningRequestScopeProvider } from '../SigningRequestScope'
import { __resetSigningActorRegistryForTests } from '../useSigningActorLifecycle'
import { useSigningStore } from '../../store'
import { approvalGate } from '../../pipeline/approvalGate'
import { signingEventBus } from '../../pipeline/signingEventBus'
import {
    MAX_TRANSACTION_SIGN_REQUESTS,
    MAX_DATA_SIGN_REQUESTS,
} from '../../constants'
import { AppError, type Nullable } from '@perawallet/wallet-core-shared'
import type {
    SignRequest,
    TransactionSignRequest,
    ArbitraryDataSignRequest,
} from '../../models'
import type { TransportResult } from '../../pipeline/types'
import { createSigningMachine } from '../../machine/createSigningMachine'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        registerStore: vi.fn(),
        createPersistStorage: () => ({
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        }),
    }
})

vi.mock('../useLocalKeyTransactionSigner', () => ({
    useLocalKeyTransactionSigner: vi.fn(() => ({
        signTransactions: vi.fn(),
    })),
}))

vi.mock('../useArbitraryDataSigner', () => ({
    useArbitraryDataSigner: vi.fn(() => ({
        signArbitraryData: vi.fn(),
    })),
}))

vi.mock('../useLocalKeyArc60Signer', () => ({
    useLocalKeyArc60Signer: vi.fn(() => ({
        signArc60: vi.fn(),
    })),
}))

vi.mock('../useMultisigTransportAdapters', () => ({
    useMultisigTransportAdapters: vi.fn(() => ({
        proposeSignRequest: vi.fn(),
        addSignatures: vi.fn(),
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAllAccounts: vi.fn(() => [
            { address: 'ADDR1', type: 'algo25' },
            { address: 'ADDR2', type: 'algo25' },
        ]),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-blockchain')
        >()
    return {
        ...original,
        useTransactionEncoder: vi.fn(() => ({
            encodeSignedTransactions: vi.fn(),
        })),
        useAlgorandClient: vi.fn(() => ({
            client: { algod: { sendRawTransaction: vi.fn() } },
        })),
        useNetwork: vi.fn(() => ({ network: 'mainnet' })),
    }
})

vi.mock('../../machine/createSigningMachine')

/**
 * Builds a mock actor whose subscriber callback can be triggered manually.
 */
const makeMockActor = (requestId: string) => {
    let subscriberCb: Nullable<(snapshot: unknown) => void> = null
    // Drives `getSnapshot().matches(...)`; rejectRequest reads this to decide
    // between the approval gate and a direct USER_REJECTED send. Defaults to a
    // pre-approval state so the gate path is exercised unless a test opts in.
    // A string models a top-level state (`awaiting_user`, `failed`); an object
    // models a nested value (`{ signing: 'hardware' }`).
    let currentState: string | Record<string, string> = 'awaiting_user'

    // Minimal stand-in for XState's `matches`: string arg compares against a
    // top-level state, object arg against a single-key nested value.
    const matches = (target: string | Record<string, string>): boolean => {
        if (typeof target === 'string') {
            return currentState === target
        }
        if (typeof currentState !== 'object') return false
        return Object.entries(target).every(
            ([key, value]) => currentState[key] === value,
        )
    }

    const actor = {
        id: requestId,
        subscribe: vi.fn((cb: (snapshot: unknown) => void) => {
            subscriberCb = cb
        }),
        start: vi.fn(),
        stop: vi.fn(),
        send: vi.fn(),
        getSnapshot: () => ({
            value: currentState,
            matches,
        }),
        // Test helper: set the state reported by getSnapshot().
        setState: (state: string | Record<string, string>) => {
            currentState = state
        },
        // Test helper: simulate actor reaching a terminal state
        simulateDone: (
            matchedState: string,
            request: SignRequest,
            extra: { transportResult?: TransportResult } = {},
        ) => {
            subscriberCb?.({
                status: 'done',
                matches: (s: string) => s === matchedState,
                context: { request, ...extra },
            })
        },
    }
    return actor
}

const makeTxRequest = (
    overrides: Partial<TransactionSignRequest> = {},
): TransactionSignRequest => ({
    id: 'tx-1',
    type: 'transactions',
    transport: 'algod',
    txs: [{ sender: { toString: () => 'ADDR1' } } as any],
    ...overrides,
})

const makeArbRequest = (
    overrides: Partial<ArbitraryDataSignRequest> = {},
): ArbitraryDataSignRequest => ({
    id: 'arb-1',
    type: 'arbitrary-data',
    transport: 'callback',
    data: [{ signer: 'ADDR1', data: 'hello', chainId: 4160 }],
    ...overrides,
})

describe('useSigningRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useSigningStore.getState().resetState()
        __resetSigningActorRegistryForTests()
    })

    describe('queue management', () => {
        test('returns empty pending requests initially', () => {
            const { result } = renderHook(() => useSigningRequest())
            expect(result.current.pendingSignRequests).toEqual([])
        })

        test('addSignRequest adds to pendingSignRequests and creates an actor', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(1)
            expect(result.current.pendingSignRequests[0].id).toBe('tx-1')
            expect(actor.start).toHaveBeenCalled()
        })

        test('throws when transaction count exceeds limit', () => {
            const { result } = renderHook(() => useSigningRequest())
            const txs = Array.from(
                { length: MAX_TRANSACTION_SIGN_REQUESTS + 1 },
                () => ({}),
            )
            const request = makeTxRequest({ txs: txs as any })

            expect(() => {
                act(() => {
                    result.current.addSignRequest(request)
                })
            }).toThrow(AppError)
        })

        test('accepts transactions at exactly the limit', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const txs = Array.from(
                { length: MAX_TRANSACTION_SIGN_REQUESTS },
                () => ({}),
            )
            const request = makeTxRequest({ txs: txs as any })

            act(() => {
                result.current.addSignRequest(request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(1)
        })

        test('throws when data sign count exceeds limit', () => {
            const { result } = renderHook(() => useSigningRequest())
            const data = Array.from(
                { length: MAX_DATA_SIGN_REQUESTS + 1 },
                () => ({ signer: 'ADDR1', data: 'test', chainId: 4160 }),
            )
            const request = makeArbRequest({ data: data as any })

            expect(() => {
                act(() => {
                    result.current.addSignRequest(request)
                })
            }).toThrow(AppError)
        })

        test('does not add duplicate requests', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
                result.current.addSignRequest(request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(1)
            expect(createSigningMachine).toHaveBeenCalledTimes(1)
        })

        test('removes request and stops actor on removeSignRequest', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                result.current.removeSignRequest(request)
            })

            expect(actor.stop).toHaveBeenCalled()
            expect(result.current.pendingSignRequests).toHaveLength(0)
        })
    })

    describe('signAndSendRequest', () => {
        test('approves the request via the approval gate', async () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({ sourceType: 'walletconnect' })

            act(() => {
                result.current.addSignRequest(request)
            })
            // Register a gate as the lifecycle would for an interactive
            // source. The hook resolves it; we then assert the deferred
            // resolves to 'approved' by awaiting `waitFor`.
            approvalGate.register('tx-1')
            const resolution = approvalGate.waitFor('tx-1')

            act(() => {
                result.current.signAndSendRequest(request)
            })

            await expect(resolution).resolves.toBe('approved')
        })

        test('currentRequest is the first pending request', () => {
            // Only the first actor is created — the queue gate prevents
            // the second from starting until the first completes.
            const actor1 = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor1 as any)

            const { result } = renderHook(() => useSigningRequest())
            const req1 = makeTxRequest({ id: 'tx-1' })
            const req2 = makeTxRequest({ id: 'tx-2' })

            act(() => {
                result.current.addSignRequest(req1)
                result.current.addSignRequest(req2)
            })

            expect(result.current.currentRequest?.id).toBe('tx-1')
        })
    })

    describe('request scope', () => {
        const scopeWrapper =
            (requestId: string) =>
            ({ children }: { children: ReactNode }) =>
                createElement(
                    SigningRequestScopeProvider,
                    { requestId },
                    children,
                )

        test('currentRequest binds to the scoped request id, not the queue head', () => {
            // The review sheet is opened for a specific request; everything
            // rendered inside it must bind to THAT request even when another
            // request sits at the queue head (e.g. a headless hardware send
            // parked in signing while a dApp request arrives behind it).
            const actor1 = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor1 as any)

            const { result } = renderHook(() => useSigningRequest(), {
                wrapper: scopeWrapper('tx-2'),
            })

            act(() => {
                result.current.addSignRequest(makeTxRequest({ id: 'tx-1' }))
                result.current.addSignRequest(makeTxRequest({ id: 'tx-2' }))
            })

            expect(result.current.currentRequest?.id).toBe('tx-2')
        })

        test('currentRequest is undefined when the scoped request left the queue', () => {
            const actor1 = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor1 as any)

            const { result } = renderHook(() => useSigningRequest(), {
                wrapper: scopeWrapper('tx-gone'),
            })

            act(() => {
                result.current.addSignRequest(makeTxRequest({ id: 'tx-1' }))
            })

            expect(result.current.currentRequest).toBeUndefined()
        })
    })

    describe('rejectRequest', () => {
        test('rejects the request via the approval gate', async () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({
                transport: 'callback',
                sourceType: 'walletconnect',
            })

            act(() => {
                result.current.addSignRequest(request)
            })
            approvalGate.register('tx-1')
            const resolution = approvalGate.waitFor('tx-1')

            act(() => {
                result.current.rejectRequest(request)
            })

            await expect(resolution).resolves.toBe('rejected')
        })

        test('sends USER_REJECTED directly to a failed actor (gate already spent)', () => {
            // After a retryable failure the actor is parked in `failed`, past
            // the approval gate the user already resolved by approving. The
            // gate is one-shot, so `approvalGate.reject` would be a no-op and
            // the cancel tap would be silently dropped. rejectRequest must
            // send USER_REJECTED straight to the actor instead.
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({
                transport: 'callback',
                sourceType: 'walletconnect',
            })

            act(() => {
                result.current.addSignRequest(request)
            })
            actor.setState('failed')

            act(() => {
                result.current.rejectRequest(request)
            })

            expect(actor.send).toHaveBeenCalledWith({ type: 'USER_REJECTED' })
        })

        test('sends USER_REJECTED directly during hardware signing (gate already spent)', () => {
            // Hardware signing runs in `signing.hardware`, past the approval
            // gate the user resolved when they confirmed the send. The gate is
            // one-shot, so `approvalGate.reject` here is a no-op and the Cancel
            // tap on the Ledger sheet was silently dropped. rejectRequest must
            // send USER_REJECTED straight to the actor, which the parent
            // forwards to the hardware child as USER_REJECTED_ON_DEVICE.
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({
                transport: 'algod',
                sourceType: 'walletconnect',
            })

            act(() => {
                result.current.addSignRequest(request)
            })
            actor.setState({ signing: 'hardware' })

            act(() => {
                result.current.rejectRequest(request)
            })

            expect(actor.send).toHaveBeenCalledWith({ type: 'USER_REJECTED' })
        })

        test('when no actor, calls reject callback and removes request for callback transport', () => {
            const mockReject = vi.fn()

            const { result } = renderHook(() => useSigningRequest())

            // Call rejectRequest for a request that was never added to the
            // store (so no actor was created by the reactive effect).
            // This tests the defensive fallback path.
            act(() => {
                result.current.rejectRequest(
                    makeTxRequest({
                        transport: 'callback',
                        reject: mockReject,
                    }),
                )
            })

            expect(mockReject).toHaveBeenCalled()
        })
    })

    describe('actor lifecycle', () => {
        test('removes request from queue when actor reaches completed state', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(1)

            act(() => {
                actor.simulateDone('completed', request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(0)
        })

        test('removes request from queue when actor reaches rejected state', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest()

            act(() => {
                result.current.addSignRequest(request)
            })

            act(() => {
                actor.simulateDone('rejected', request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(0)
        })

        test('calls reject callback when actor reaches rejected state with callback transport', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const mockReject = vi.fn()
            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({
                transport: 'callback',
                reject: mockReject,
            })

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                actor.simulateDone('rejected', request)
            })

            expect(mockReject).toHaveBeenCalledTimes(1)
        })

        test('calls reject callback when actor reaches rejected state with algod transport', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const mockReject = vi.fn()
            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({
                transport: 'algod',
                reject: mockReject,
            })

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                actor.simulateDone('rejected', request)
            })

            expect(mockReject).toHaveBeenCalledTimes(1)
        })

        test('publishes a completed event on the bus when the actor finishes', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const onEvent = vi.fn()
            const unsubscribe = signingEventBus.subscribe(onEvent)

            const { result } = renderHook(() => useSigningRequest())
            const request = makeTxRequest({ sourceType: 'walletconnect' })
            const transportResult: TransportResult = {
                type: 'algod-submit',
                txIds: ['TX1'],
            } as unknown as TransportResult

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                actor.simulateDone('completed', request, { transportResult })
            })

            unsubscribe()
            expect(onEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'completed',
                    request: expect.objectContaining({ id: 'tx-1' }),
                    result: transportResult,
                }),
            )
        })

        test('drops non-interactive requests from the queue on completion', () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as any)

            const { result } = renderHook(() => useSigningRequest())
            // No `sourceType` → not in INTERACTIVE_SOURCES → non-interactive.
            const request = makeTxRequest({ transport: 'callback' })

            act(() => {
                result.current.addSignRequest(request)
            })
            act(() => {
                actor.simulateDone('completed', request)
            })

            expect(result.current.pendingSignRequests).toHaveLength(0)
        })
    })
})
