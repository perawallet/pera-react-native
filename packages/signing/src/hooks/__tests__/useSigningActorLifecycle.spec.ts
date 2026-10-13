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
import { AppError, logger, type Nullable } from '@perawallet/wallet-core-shared'

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

vi.mock('../useAuthDataSigner', () => ({
    useAuthDataSigner: vi.fn(() => ({
        signAuthData: vi.fn(),
    })),
}))

vi.mock('../useMultisigTransportAdapters', () => ({
    useMultisigTransportAdapters: vi.fn(() => ({
        adaptersFor: () => ({
            proposeSignRequest: vi.fn(),
            addSignatures: vi.fn(),
            getMsigMetadata: vi.fn(),
            getDeviceId: vi.fn(),
        }),
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
            { address: 'ADDR1', custody: { kind: 'local', seed: null } },
            { address: 'ADDR2', custody: { kind: 'local', seed: null } },
        ]),
    }
})

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
    getSelectedScope: vi.fn((chainId: string) => ({
        chainId,
        networkId: 'testnet',
    })),
}))

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

const mockIsRequestGroupAlreadySubmitted = vi.hoisted(() => vi.fn())
const mockFindStaleGroupReason = vi.hoisted(() => vi.fn())
// Only storage-restored requests reach the ledger guard; the store's own spec
// covers which ids get marked, so drive the flag directly here.
const mockWasRestoredFromStorage = vi.hoisted(() => vi.fn())
vi.mock('../../store', async importOriginal => {
    const actual = await importOriginal<typeof import('../../store')>()
    return {
        ...actual,
        wasRestoredFromStorage: (...args: unknown[]) =>
            mockWasRestoredFromStorage(...args),
    }
})

// Imports (must follow vi.mock calls)

import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    isSignRequestAwaitingPreflight,
    useSigningActorLifecycle,
    __resetSigningActorRegistryForTests,
} from '../useSigningActorLifecycle'
import { useSigningStore } from '../../store'
import { approvalGate } from '../../pipeline/approvalGate'
import { signingEventBus } from '../../pipeline/signingEventBus'
import { createSigningMachine } from '../../machine/createSigningMachine'
import { StaleSignRequestError } from '../../pipeline/errors'
import { flushQueue } from '../../test-utils/queue'
import type { SignRequest, TransactionSignRequest } from '../../models'
import { registerFakeBroadcaster } from '../../__tests__/fakeBroadcaster'
import type { StaleGroupReason } from '../../broadcaster'
import { registerFakePlannerAdapter } from '../../__tests__/fakePlannerAdapter'

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
        chainId: 'algorand',
        transport: 'algod',
        txs: [{ sender: { toString: () => 'ADDR1' } } as never],
        ...overrides,
    }) as TransactionSignRequest

describe('useSigningActorLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerFakeBroadcaster({
            isRequestGroupAlreadySubmitted: mockIsRequestGroupAlreadySubmitted,
            findStaleGroupReason: mockFindStaleGroupReason,
        })
        mockIsRequestGroupAlreadySubmitted.mockResolvedValue(false)
        mockFindStaleGroupReason.mockResolvedValue(null)
        mockWasRestoredFromStorage.mockReturnValue(false)
        useSigningStore.getState().resetState()
        __resetSigningActorRegistryForTests()
    })

    test('starts an actor when a request is queued', async () => {
        const actor = makeMockActor('tx-1')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest()

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        await flushQueue()

        expect(createSigningMachine).toHaveBeenCalledTimes(1)
        expect(actor.start).toHaveBeenCalled()
        expect(actor.subscribe).toHaveBeenCalled()
    })

    test("captures the request chain's selected scope for the machine and its transports", async () => {
        const actor = makeMockActor('tx-1')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        act(() => {
            useSigningStore.getState().addSignRequest(makeTxRequest())
        })
        await flushQueue()

        const deps = vi.mocked(createSigningMachine).mock.calls[0][2]
        expect(getSelectedScope).toHaveBeenCalledWith('algorand')
        expect(deps.scope).toEqual({
            chainId: 'algorand',
            networkId: 'testnet',
        })
    })

    test("hands the machine an encoder that returns the planner's unsigned bytes", async () => {
        const bytes = new Uint8Array([9, 9])
        const encodeUnsignedTransaction = vi.fn(() => bytes)
        registerFakePlannerAdapter({ encodeUnsignedTransaction })
        const actor = makeMockActor('tx-1')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        act(() => {
            useSigningStore.getState().addSignRequest(makeTxRequest())
        })
        await flushQueue()

        const deps = vi.mocked(createSigningMachine).mock.calls[0][2]
        const txn = { tag: 'TXN' } as never
        expect(deps.encodeTransaction(txn)).toBe(bytes)
        expect(encodeUnsignedTransaction).toHaveBeenCalledWith(txn)
    })

    test('suppresses a re-presented request whose group is already submitted', async () => {
        mockIsRequestGroupAlreadySubmitted.mockResolvedValue(true)
        mockWasRestoredFromStorage.mockReturnValue(true)
        const actor = makeMockActor('tx-1')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest()

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        await flushQueue()

        // The ledger guard is consulted, the request is dropped instead of
        // re-presented, and no actor is ever created.
        expect(mockIsRequestGroupAlreadySubmitted).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'tx-1' }),
        )
        expect(createSigningMachine).not.toHaveBeenCalled()
        expect(useSigningStore.getState().pendingSignRequests).toHaveLength(0)
    })

    describe('stale WalletConnect requests', () => {
        const makeWalletConnectRequest = (
            overrides: Partial<TransactionSignRequest> = {},
        ) =>
            makeTxRequest({
                sourceType: 'walletconnect',
                transport: 'callback',
                reject: vi.fn(async () => {}),
                ...overrides,
            })

        /** Holds the stale check open until the test settles it. */
        const holdStaleCheck = () => {
            let settle: (reason: StaleGroupReason | null) => void = () => {}
            mockFindStaleGroupReason.mockImplementationOnce(
                () =>
                    new Promise<StaleGroupReason | null>(resolve => {
                        settle = resolve
                    }),
            )
            return (reason: StaleGroupReason | null) => settle(reason)
        }

        test('declines a request whose group is already on chain instead of presenting it', async () => {
            mockFindStaleGroupReason.mockResolvedValue('already-on-chain')
            const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
            renderHook(() => useSigningActorLifecycle())
            const request = makeWalletConnectRequest()

            act(() => {
                useSigningStore.getState().addSignRequest(request)
            })
            await flushQueue()

            expect(createSigningMachine).not.toHaveBeenCalled()
            expect(useSigningStore.getState().pendingSignRequests).toHaveLength(
                0,
            )
            expect(request.reject).toHaveBeenCalledWith({
                kind: 'softReject',
                error: expect.any(StaleSignRequestError),
            })
            expect(error).toHaveBeenCalledWith(
                'Declined a dApp sign request whose group is already on chain',
                expect.objectContaining({
                    id: 'tx-1',
                    reason: 'already-on-chain',
                }),
            )
            error.mockRestore()
        })

        test('declines an expired request without reporting it as an error', async () => {
            mockFindStaleGroupReason.mockResolvedValue('expired')
            const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
            const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
            renderHook(() => useSigningActorLifecycle())
            const request = makeWalletConnectRequest()

            act(() => {
                useSigningStore.getState().addSignRequest(request)
            })
            await flushQueue()

            expect(request.reject).toHaveBeenCalledTimes(1)
            expect(error).not.toHaveBeenCalled()
            expect(warn).toHaveBeenCalledWith(
                'Declined a dApp sign request whose group has expired',
                expect.objectContaining({ reason: 'expired' }),
            )
            error.mockRestore()
            warn.mockRestore()
        })

        test('presents a request whose group can still land', async () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as never)
            renderHook(() => useSigningActorLifecycle())
            const request = makeWalletConnectRequest()

            act(() => {
                useSigningStore.getState().addSignRequest(request)
            })
            await flushQueue()

            expect(mockFindStaleGroupReason).toHaveBeenCalledWith(request)
            expect(createSigningMachine).toHaveBeenCalledTimes(1)
            expect(request.reject).not.toHaveBeenCalled()
        })

        test('presents the request when the stale check itself fails', async () => {
            mockFindStaleGroupReason.mockRejectedValue(new Error('algod down'))
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as never)
            renderHook(() => useSigningActorLifecycle())

            act(() => {
                useSigningStore
                    .getState()
                    .addSignRequest(makeWalletConnectRequest())
            })
            await flushQueue()

            expect(createSigningMachine).toHaveBeenCalledTimes(1)
        })

        test('never checks a request the wallet itself started', async () => {
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as never)
            renderHook(() => useSigningActorLifecycle())

            act(() => {
                useSigningStore.getState().addSignRequest(makeTxRequest())
            })
            await flushQueue()

            expect(mockFindStaleGroupReason).not.toHaveBeenCalled()
            expect(createSigningMachine).toHaveBeenCalledTimes(1)
        })

        test('checks a request once while the queue re-renders around the pending check', async () => {
            const settle = holdStaleCheck()
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as never)
            renderHook(() => useSigningActorLifecycle())

            act(() => {
                useSigningStore
                    .getState()
                    .addSignRequest(makeWalletConnectRequest())
            })
            act(() => {
                useSigningStore
                    .getState()
                    .addSignRequest(makeWalletConnectRequest({ id: 'tx-2' }))
            })
            await flushQueue()
            settle(null)
            await flushQueue()

            expect(mockFindStaleGroupReason).toHaveBeenCalledTimes(1)
            expect(createSigningMachine).toHaveBeenCalledTimes(1)
        })

        test('starts no actor for a request withdrawn while its check was pending, and keeps the queue moving', async () => {
            // A WalletConnect expiry withdraws the request mid-check; an actor
            // started for it afterwards would have no sheet and block the
            // queue for every later request.
            const settle = holdStaleCheck()
            const nextActor = makeMockActor('tx-2')
            vi.mocked(createSigningMachine).mockReturnValue(nextActor as never)
            renderHook(() => useSigningActorLifecycle())
            const withdrawn = makeWalletConnectRequest()

            act(() => {
                useSigningStore.getState().addSignRequest(withdrawn)
            })
            await flushQueue()
            act(() => {
                useSigningStore.getState().removeSignRequest(withdrawn)
            })
            settle(null)
            await flushQueue()
            act(() => {
                useSigningStore
                    .getState()
                    .addSignRequest(makeTxRequest({ id: 'tx-2' }))
            })
            await flushQueue()

            expect(createSigningMachine).toHaveBeenCalledTimes(1)
            expect(vi.mocked(createSigningMachine).mock.calls[0][0].id).toBe(
                'tx-2',
            )
        })

        test('holds the review sheet back until the check lets the request through', async () => {
            const settle = holdStaleCheck()
            const actor = makeMockActor('tx-1')
            vi.mocked(createSigningMachine).mockReturnValue(actor as never)
            renderHook(() => useSigningActorLifecycle())
            const request = makeWalletConnectRequest()

            act(() => {
                useSigningStore.getState().addSignRequest(request)
            })
            expect(isSignRequestAwaitingPreflight(request)).toBe(true)
            await flushQueue()
            expect(isSignRequestAwaitingPreflight(request)).toBe(true)

            settle(null)
            await flushQueue()

            expect(isSignRequestAwaitingPreflight(request)).toBe(false)
        })
    })

    test('a second hook instance does not duplicate the actor for the same request', async () => {
        const actor = makeMockActor('tx-1')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)

        renderHook(() => useSigningActorLifecycle())
        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest()

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        await flushQueue()

        // Module-level registry dedupes — only one machine ever gets created.
        expect(createSigningMachine).toHaveBeenCalledTimes(1)
    })

    test('registers an approval gate for interactive sources', async () => {
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
        await flushQueue()

        expect(registerSpy).toHaveBeenCalledWith('tx-int')
    })

    test('does NOT register an approval gate for headless local sources', async () => {
        const actor = makeMockActor('tx-local')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const registerSpy = vi.spyOn(approvalGate, 'register')

        renderHook(() => useSigningActorLifecycle())
        act(() => {
            useSigningStore
                .getState()
                .addSignRequest(makeTxRequest({ id: 'tx-local' }))
        })
        await flushQueue()

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
        await flushQueue()

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
        await flushQueue()
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
        await flushQueue()
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
        await flushQueue()
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

    test('failed state normalises a non-Error context.error into a real Error', async () => {
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
        await flushQueue()
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

    test('non-interactive failure stops the actor and drops it from the queue', async () => {
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
        await flushQueue()
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

    test('interactive failure keeps the request for the inline error UI (keepForInlineError)', async () => {
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
        await flushQueue()
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

    test('stopActor stops the running actor and releases the approval gate', async () => {
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
        await flushQueue()

        act(() => {
            result.current.stopActor('tx-stop')
        })

        expect(actor.stop).toHaveBeenCalled()
        expect(unregisterSpy).toHaveBeenCalledWith('tx-stop')
        expect(releaseSpy).toHaveBeenCalledWith('tx-stop')
        // Actor was removed from the registry, so getActorRef returns nothing.
        expect(result.current.getActorRef('tx-stop')).toBeUndefined()
    })

    test('publishes a `started` bus event when the actor enters `validating`', async () => {
        const actor = makeMockActor('tx-validating')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const onEvent = vi.fn()
        const unsubscribe = signingEventBus.subscribe(onEvent)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({ id: 'tx-validating' })
        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        await flushQueue()

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

    test('publishes a `signing-started` event when entering a signing substate', async () => {
        const actor = makeMockActor('tx-signing')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const onEvent = vi.fn()
        const unsubscribe = signingEventBus.subscribe(onEvent)

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({ id: 'tx-signing' })
        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        await flushQueue()

        act(() => {
            actor.emit({
                value: { signing: 'local' },
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
            signerType: 'local',
        })
    })

    test('completed terminal drops the actor, releases the bus, and removes the request', async () => {
        const actor = makeMockActor('tx-done')
        vi.mocked(createSigningMachine).mockReturnValue(actor as never)
        const releaseSpy = vi.spyOn(signingEventBus, 'releaseRequest')

        renderHook(() => useSigningActorLifecycle())
        const request = makeTxRequest({ id: 'tx-done' })

        act(() => {
            useSigningStore.getState().addSignRequest(request)
        })
        await flushQueue()
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
