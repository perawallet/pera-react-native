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
import { renderHook, act } from '@testing-library/react'
import { AppError, type Nullable } from '@perawallet/wallet-core-shared'

// Module mocks — mirror useSigningRequest.spec.ts conventions

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
        getMsigMetadata: vi.fn(),
        getDeviceId: vi.fn(),
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
            encodeTransactionRaw: vi.fn(),
        })),
        useAlgorandClient: vi.fn(() => ({
            client: { algod: { sendRawTransaction: vi.fn() } },
        })),
        useNetwork: vi.fn(() => ({ network: 'mainnet' })),
    }
})

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        hardwareWalletRegistry: undefined,
        keyValueStorage: {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        },
    }),
}))

vi.mock('../../machine/createSigningMachine')

// Imports (must follow vi.mock calls)

import {
    useSigningActorLifecycle,
    __resetSigningActorRegistryForTests,
} from '../useSigningActorLifecycle'
import { useSigningStore } from '../../store'
import { approvalGate } from '../../pipeline/approvalGate'
import { signingEventBus } from '../../pipeline/signingEventBus'
import { createSigningMachine } from '../../machine/createSigningMachine'
import type { SignRequest, TransactionSignRequest } from '../../models'

type MockActor = {
    id: string
    subscribe: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    send: ReturnType<typeof vi.fn>
    getSnapshot: () => unknown
    /**
     * Drives the subscribed callback to a given XState state value. Pass
     * `value: 'awaiting_user' | 'completed' | 'failed' | 'rejected'` and
     * the test fixture context fields you want to assert against.
     */
    emit: (snapshot: {
        value?: string | { signing: string }
        status?: 'active' | 'done'
        request: SignRequest
        error?: unknown
        transportResult?: unknown
    }) => void
}

const makeMockActor = (requestId: string): MockActor => {
    let cb: Nullable<(snapshot: unknown) => void> = null
    let current: {
        value?: string | { signing: string }
        status?: 'active' | 'done'
    } = {
        value: 'idle',
        status: 'active',
    }

    const stateMatches = (
        state: string,
        value: string | { signing: string } | undefined,
    ): boolean => {
        if (typeof value === 'string') return state === value
        if (value && typeof value === 'object' && 'signing' in value) {
            // Match both the parent 'signing' state and the compound child.
            return state === 'signing' || state === `signing.${value.signing}`
        }
        return false
    }

    return {
        id: requestId,
        subscribe: vi.fn((handler: (snapshot: unknown) => void) => {
            cb = handler
        }),
        start: vi.fn(),
        stop: vi.fn(),
        send: vi.fn(),
        getSnapshot: () => ({
            value: current.value,
            matches: (s: string) => stateMatches(s, current.value),
        }),
        emit: snapshot => {
            current = {
                value: snapshot.value ?? 'idle',
                status: snapshot.status ?? 'active',
            }
            cb?.({
                value: snapshot.value,
                status: snapshot.status ?? 'active',
                matches: (s: string) => stateMatches(s, snapshot.value),
                context: {
                    request: snapshot.request,
                    error: snapshot.error,
                    transportResult: snapshot.transportResult,
                },
            })
        },
    }
}

const makeTxRequest = (
    overrides: Partial<TransactionSignRequest> = {},
): TransactionSignRequest =>
    ({
        id: 'tx-1',
        type: 'transactions',
        transport: 'algod',
        txs: [{ sender: { toString: () => 'ADDR1' } } as never],
        ...overrides,
    }) as TransactionSignRequest

describe('useSigningActorLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useSigningStore.getState().resetState()
        __resetSigningActorRegistryForTests()
    })

    test('starts an actor when a request is queued', () => {
        const actor = makeMockActor('tx-1')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest()

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })

        expect(createSigningMachine).toHaveBeenCalledTimes(1)
        expect(actor.start).toHaveBeenCalled()
        expect(actor.subscribe).toHaveBeenCalled()
    })

    test('a second hook instance does not duplicate the actor for the same request', () => {
        const actor = makeMockActor('tx-1')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest()

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })

        // Module-level registry dedupes — only one machine ever gets created.
        expect(createSigningMachine).toHaveBeenCalledTimes(1)
    })

    test('registers an approval gate for interactive sources', () => {
        const actor = makeMockActor('tx-int')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const registerSpy = vi.spyOn(approvalGate, 'register')

        renderHook(() => useSigningActorLifecycle())
        act(() => {
            useSigningStore.getState().addSignRequest(
                makeTxRequest({
                    id: 'tx-int',
                    sourceType: 'walletconnect',
                }),
            )
        })

        expect(registerSpy).toHaveBeenCalledWith('tx-int')
    })

    test('does NOT register an approval gate for headless local sources', () => {
        const actor = makeMockActor('tx-local')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const registerSpy = vi.spyOn(approvalGate, 'register')

        renderHook(() => useSigningActorLifecycle())
        act(() => {
            useSigningStore
                .getState()
                .addSignRequest(makeTxRequest({ id: 'tx-local' }))
        })

        expect(registerSpy).not.toHaveBeenCalled()
    })

    test('awaiting_user snapshot bridges through approvalGate.waitFor and forwards USER_APPROVED', async () => {
        // Covers lines 300-304: awaitingApprovalSet.add → approvalGate.waitFor
        // → actor.send({ type: 'USER_APPROVED' }) once the gate resolves.
        const actor = makeMockActor('tx-awaiting')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({
            id: 'tx-awaiting',
            sourceType: 'walletconnect',
            transport: 'callback',
        })

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })

        // Drive through the awaiting_user state — this is where the lifecycle
        // arms the approvalGate.waitFor closure.
        act(() => {
            actor.emit({ value: 'awaiting_user', request })
        })

        // The gate was registered on creation (interactive source); now we
        // resolve it from the outside as the user would by approving.
        await act(async () => {
            approvalGate.approve('tx-awaiting')
            // Let the promise microtask flush.
            await Promise.resolve()
        })

        expect(actor.send).toHaveBeenCalledWith({ type: 'USER_APPROVED' })
    })

    test('rejected gate result forwards USER_REJECTED to the actor', async () => {
        const actor = makeMockActor('tx-reject')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({
            id: 'tx-reject',
            sourceType: 'walletconnect',
            transport: 'callback',
        })

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        act(() => {
            actor.emit({ value: 'awaiting_user', request })
        })

        await act(async () => {
            approvalGate.reject('tx-reject')
            await Promise.resolve()
        })

        expect(actor.send).toHaveBeenCalledWith({ type: 'USER_REJECTED' })
    })

    test('cancelled gate result (lifecycle unregister) does NOT send any event to the actor', async () => {
        // The `if (result === 'cancelled') return` early-out is the path
        // taken when the lifecycle's own terminal handler unregisters the
        // gate. The closure must silently no-op rather than send a stale
        // USER_APPROVED/USER_REJECTED.
        const actor = makeMockActor('tx-cancel')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({
            id: 'tx-cancel',
            sourceType: 'walletconnect',
            transport: 'callback',
        })

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        act(() => {
            actor.emit({ value: 'awaiting_user', request })
        })

        // Unregister with 'cancelled' — the lifecycle terminal handler would
        // do this; we trigger it directly to exercise the early-out.
        await act(async () => {
            approvalGate.unregister('tx-cancel')
            await Promise.resolve()
        })

        expect(actor.send).not.toHaveBeenCalled()
    })

    test('failed state publishes a `failed` event and calls request.error with the normalised Error', async () => {
        // Covers lines 354-365: failed branch wires snapshot.context.error
        // (Error or non-Error) through to the bus and the request callback.
        const actor = makeMockActor('tx-fail')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const errorCb = vi.fn()
        const onEvent = vi.fn()
        const unsubscribe = signingEventBus.subscribe(onEvent)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({
            id: 'tx-fail',
            transport: 'callback',
            error: errorCb,
        })

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        const originalError = new AppError('boom', {
            severity: 'medium' as never,
            category: 'execution' as never,
            recoverable: false,
            params: {},
        })
        act(() => {
            actor.emit({
                value: 'failed',
                status: 'active',
                request,
                error: originalError,
            })
        })
        unsubscribe()

        expect(errorCb).toHaveBeenCalledWith(originalError)
        expect(onEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'failed',
                request: expect.objectContaining({ id: 'tx-fail' }),
                error: originalError,
            }),
        )
    })

    test('failed state normalises a non-Error context.error into a real Error', () => {
        // Covers the false branch of `error instanceof Error` in the failed
        // terminal handler. Without normalisation downstream consumers
        // (toast / sheet) crash on `error.message`.
        const actor = makeMockActor('tx-fail-2')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const errorCb = vi.fn()

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({
            id: 'tx-fail-2',
            transport: 'callback',
            error: errorCb,
        })

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        act(() => {
            actor.emit({
                value: 'failed',
                status: 'active',
                request,
                error: 'not-an-error',
            })
        })

        expect(errorCb).toHaveBeenCalledWith(expect.any(Error))
        expect(errorCb.mock.calls[0][0].message).toBe('Signing failed')
    })

    test('non-interactive failure stops the actor and drops it from the queue', () => {
        // Internal/headless requests treat `failed` as terminal; the actor
        // and the queued request both go away. `failed` is a non-final state,
        // so the lifecycle must stop the actor explicitly — otherwise it's
        // orphaned (removed from the map, unreachable by stopActor, its
        // subscription never torn down).
        const actor = makeMockActor('tx-headless-fail')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({
            id: 'tx-headless-fail',
            transport: 'callback',
            // No sourceType → not in INTERACTIVE_SOURCES → non-interactive.
        })

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        act(() => {
            actor.emit({
                value: 'failed',
                status: 'active',
                request,
                error: new Error('boom'),
            })
        })

        expect(actor.stop).toHaveBeenCalled()
        expect(useSigningStore.getState().pendingSignRequests).toHaveLength(0)
    })

    test('interactive failure keeps the request for the inline error UI (keepForInlineError)', () => {
        // Interactive failures stay in the queue so the sheet can render the
        // inline error view — the user dismisses via removeSignRequest.
        const actor = makeMockActor('tx-int-fail')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({
            id: 'tx-int-fail',
            sourceType: 'walletconnect',
            transport: 'callback',
        })

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        // Retryable error: AppError without metadata.retryable=false.
        const retryable = new AppError('retry', {
            severity: 'medium' as never,
            category: 'execution' as never,
            recoverable: true,
            retryable: true,
            params: {},
        })
        act(() => {
            actor.emit({
                value: 'failed',
                status: 'active',
                request,
                error: retryable,
            })
        })

        // Request stays queued for the inline error view.
        expect(useSigningStore.getState().pendingSignRequests).toHaveLength(1)
    })

    test('stopActor stops the running actor and releases the approval gate', () => {
        const actor = makeMockActor('tx-stop')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const unregisterSpy = vi.spyOn(approvalGate, 'unregister')
        const releaseSpy = vi.spyOn(signingEventBus, 'releaseRequest')

        const { result } = renderHook(() => useSigningActorLifecycle())
        act(() => {
            useSigningStore
                .getState()
                .addSignRequest(makeTxRequest({ id: 'tx-stop' }))
        })

        act(() => {
            result.current.stopActor('tx-stop')
        })

        expect(actor.stop).toHaveBeenCalled()
        expect(unregisterSpy).toHaveBeenCalledWith('tx-stop')
        expect(releaseSpy).toHaveBeenCalledWith('tx-stop')
        // Actor was removed from the registry, so getActorRef returns nothing.
        expect(result.current.getActorRef('tx-stop')).toBeUndefined()
    })

    test('publishes a `started` bus event when the actor enters `validating`', () => {
        const actor = makeMockActor('tx-validating')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const onEvent = vi.fn()
        const unsubscribe = signingEventBus.subscribe(onEvent)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({ id: 'tx-validating' })
        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })

        act(() => {
            actor.emit({ value: 'validating', request })
        })
        // A second validating tick must NOT republish (dedupe via startedSet).
        act(() => {
            actor.emit({ value: 'validating', request })
        })

        unsubscribe()
        const startedEvents = onEvent.mock.calls.filter(
            ([ev]) => (ev as { type: string }).type === 'started',
        )
        expect(startedEvents).toHaveLength(1)
        expect(startedEvents[0][0]).toMatchObject({
            type: 'started',
            request: expect.objectContaining({ id: 'tx-validating' }),
        })
    })

    test('publishes a `signing-started` event when entering a signing substate', () => {
        const actor = makeMockActor('tx-signing')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const onEvent = vi.fn()
        const unsubscribe = signingEventBus.subscribe(onEvent)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({ id: 'tx-signing' })
        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })

        act(() => {
            actor.emit({
                value: { signing: 'localKey' },
                request,
            })
        })

        unsubscribe()
        const signingEvents = onEvent.mock.calls.filter(
            ([ev]) => (ev as { type: string }).type === 'signing-started',
        )
        expect(signingEvents).toHaveLength(1)
        expect(signingEvents[0][0]).toMatchObject({
            type: 'signing-started',
            signerType: 'localKey',
        })
    })

    test('completed terminal drops the actor, releases the bus, and removes the request', () => {
        const actor = makeMockActor('tx-done')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const releaseSpy = vi.spyOn(signingEventBus, 'releaseRequest')

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({ id: 'tx-done' })

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        act(() => {
            actor.emit({
                value: 'completed',
                status: 'done',
                request,
                transportResult: { type: 'algod-submit', txIds: ['TX1'] },
            })
        })

        expect(releaseSpy).toHaveBeenCalledWith('tx-done')
        expect(useSigningStore.getState().pendingSignRequests).toHaveLength(0)
    })
})
