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

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type Mock,
} from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { AppError } from '@perawallet/wallet-core-shared'
import type { Connection } from '@perawallet/wallet-extension-connections'
import i18n from '@i18n/index'
import type { ReactElement } from 'react'

/** Just enough of `ConnectionProposal` for the subscription-wiring tests. */
type MockProposal = {
    proposalId: string
    pairingId: string
    expiresAt: number
    approve: Mock<(accounts: string[]) => Promise<Connection>>
    reject: Mock<(reason?: string) => Promise<void>>
}

const makeProposal = (
    proposalId: string,
    pairingId = proposalId,
): MockProposal => ({
    proposalId,
    pairingId,
    expiresAt: Date.now() + 60_000,
    approve: vi.fn((_accounts: string[]) =>
        Promise.resolve<Connection>({
            id: proposalId,
            kind: 'walletconnect-v1',
            name: 'dApp',
            peer: { name: 'dApp' },
            accounts: ['AAAA'],
            status: 'active',
            createdAt: 0,
            lastActiveAt: 0,
        }),
    ),
    reject: vi.fn((_reason?: string) => Promise.resolve()),
})

/**
 * `requestBottomSheet` is mocked, so `contents` is never actually rendered
 * — this reads the wrapped `ConnectionProposal` straight off the React
 * element's props instead, which is how the tests drive
 * `useConnectionsProvider`'s own `approve`/`reject` wrapping without
 * rendering `ConnectionApprovalView` at all.
 */
const wrappedProposalFrom = (
    call: readonly unknown[],
): MockProposal & { proposalId: string } => {
    const [{ contents }] = call as [
        { contents: ReactElement<{ proposal: MockProposal }> },
    ]
    return contents.props.proposal
}

const order: string[] = []
const mockImport = vi.fn(async () => {
    order.push('import')
    return { imported: 0, skipped: 0 }
})
const mockInitialize = vi.fn(async () => void order.push('initialize'))

// Captures the listener `useConnectionsProvider` passes to
// `subscribeToProposals`, so tests can call it directly to simulate a
// proposal arriving — the no-op version this used to be couldn't drive any
// of the subscription's own logic (the double-open guard, dismiss-on-settle,
// the release-on-failure catch path, or the queue) at all.
const proposalSubscription: {
    listener: ((proposal: MockProposal) => void) | null
} = { listener: null }

/** Captured the same way, so tests can drive a scoped registry error. */
type ErrorScope = { connectionId?: string; pairingId?: string }
const errorSubscription: {
    listener: ((error: Error, scope?: ErrorScope) => void) | null
} = { listener: null }
/** The failures under test happen under an open approval sheet, before approval. */
const scoped = (pairingId: string): ErrorScope => ({ pairingId })

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    importLegacyConnections: mockImport,
    createWalletConnectV1Handler: () => ({ kind: 'walletconnect-v1' }),
}))
vi.mock('@perawallet/wallet-core-connections', () => ({
    createConnectionRegistry: () => ({
        register: vi.fn(),
        initialize: mockInitialize,
        teardown: vi.fn(async () => {}),
        subscribeToProposals: (listener: (proposal: MockProposal) => void) => {
            proposalSubscription.listener = listener
            return () => {
                proposalSubscription.listener = null
            }
        },
        subscribeToErrors: (
            listener: (error: Error, scope?: ErrorScope) => void,
        ) => {
            errorSubscription.listener = listener
            return () => {
                errorSubscription.listener = null
            }
        },
    }),
    useConnectionSigningAdapter: vi.fn(),
    hydrateConnectionsStore: vi.fn(() => () => {}),
}))

const showToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast }),
}))

type SheetRequest = {
    id?: string
    contents: ReactElement
    options?: Record<string, unknown>
}
const requestBottomSheet = vi.fn((_request: SheetRequest) =>
    Promise.resolve(undefined),
)
const dismissBottomSheet = vi.fn()
vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: requestBottomSheet,
        dismiss: dismissBottomSheet,
    }),
}))

// Controllable migration gate. Starts CLOSED (`isChecking: true`), mirroring
// `migrationGateStore`'s real initial state — the load-bearing detail that
// keeps `importLegacyConnections` from ever racing `migrateWalletConnect`
// (see the doc comment on `useConnectionsProvider`). A plain mutable object
// rather than a store: tests flip it and force a re-render with `rerender()`,
// which is enough to prove the effect reacts to it — no reactivity of its
// own is needed.
const gate = { isChecking: true, needsMigration: false }
vi.mock('@perawallet/wallet-core-migrate', () => ({
    useNeedsMigration: () => ({ ...gate }),
}))

// Controllable keystore-ready promise, read fresh on every `getKeystore()`
// call. Defaults to already-resolved so tests that don't care about
// hydration timing don't have to think about it; a test can swap in a
// pending promise to prove the boot effect genuinely awaits it rather than
// merely calling it. `getProvider()` only needs to satisfy the shape the
// (mocked) `createConnectionRegistry` / `importLegacyConnections` /
// `hydrateConnectionsStore` calls above ignore their arguments anyway — the
// real store/storage values are irrelevant here.
let keystoreReady: Promise<void> = Promise.resolve()

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        connections: { store: {} },
        keyValueStorage: {},
    }),
    getKeystore: () => ({
        ready: keystoreReady.then(() => void order.push('keystore')),
    }),
}))

const { getActiveConnectionRegistry } = await import('../../activeRegistry')
const { useConnectionsProvider } = await import('../useConnectionsProvider')

/** Flushes pending microtasks without asserting anything ran. */
const flush = (): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, 0))

describe('useConnectionsProvider', () => {
    beforeEach(() => {
        order.length = 0
        gate.isChecking = true
        gate.needsMigration = false
        keystoreReady = Promise.resolve()
        mockImport.mockClear()
        mockInitialize.mockClear()
        proposalSubscription.listener = null
        errorSubscription.listener = null
        requestBottomSheet.mockClear()
        requestBottomSheet.mockImplementation(() => Promise.resolve(undefined))
        dismissBottomSheet.mockClear()
        showToast.mockClear()
    })

    afterEach(() => {
        cleanup()
    })

    it('migrates before initializing handlers, once the migration gate opens', async () => {
        const { rerender } = renderHook(() => useConnectionsProvider())

        // The gate starts closed (isChecking: true) — nothing may run yet.
        await flush()
        expect(mockImport).not.toHaveBeenCalled()
        expect(mockInitialize).not.toHaveBeenCalled()

        gate.isChecking = false
        rerender()

        await waitFor(() => expect(mockInitialize).toHaveBeenCalled())
        // A handler whose restore() runs before the migration reports zero
        // sessions and the user's dApps silently vanish. 'keystore' leading
        // the order proves the hydration wait actually happened — deleting
        // `await getKeystore().ready` would drop it from this list entirely
        // (see the next test for that in isolation).
        expect(order).toEqual(['keystore', 'import', 'initialize'])
    })

    it('never starts while a migration could still be running', async () => {
        // isChecking has already resolved, but a native migration is in
        // progress — the two importers must not race regardless of which
        // flag is still true.
        gate.isChecking = false
        gate.needsMigration = true

        renderHook(() => useConnectionsProvider())
        await flush()

        expect(mockImport).not.toHaveBeenCalled()
        expect(mockInitialize).not.toHaveBeenCalled()
    })

    it('waits for keystore hydration before importing legacy connections', async () => {
        gate.isChecking = false
        let resolveReady: () => void = () => {}
        keystoreReady = new Promise(resolve => {
            resolveReady = resolve
        })

        renderHook(() => useConnectionsProvider())
        await flush()
        // Hydration hasn't resolved yet — importLegacyConnections must not
        // have started. hasSecret() reads the keystore's reactive store
        // synchronously and reports false, not "wait", before hydration.
        expect(mockImport).not.toHaveBeenCalled()

        resolveReady()

        await waitFor(() => expect(mockImport).toHaveBeenCalled())
    })

    // `clearAllStores()` — run by both "Delete all data" and the duress wipe
    // — resets the migration gate store, reopening the gate under a provider
    // that stays mounted. Without a second boot the registry is dead for the
    // rest of the session and every later pairing times out in silence.
    it('boots again after a wipe reopens and then closes the migration gate', async () => {
        gate.isChecking = false
        const { rerender } = renderHook(() => useConnectionsProvider())
        await waitFor(() => expect(mockInitialize).toHaveBeenCalledTimes(1))

        gate.isChecking = true
        rerender()
        gate.isChecking = false
        rerender()

        await waitFor(() => expect(mockInitialize).toHaveBeenCalledTimes(2))
    })

    // `useDeleteAllData` also runs from `AutoLockGuard`, which sits above
    // this provider, so the context is out of reach there.
    it('publishes the registry for callers mounted above the provider', () => {
        expect(getActiveConnectionRegistry()).toBeNull()

        const { result, unmount } = renderHook(() => useConnectionsProvider())
        expect(getActiveConnectionRegistry()).toBe(result.current)

        unmount()
        expect(getActiveConnectionRegistry()).toBeNull()
    })

    describe('proposal subscription', () => {
        it('opens a bottom sheet for an inbound proposal', () => {
            renderHook(() => useConnectionsProvider())
            const proposal = makeProposal('p1')

            proposalSubscription.listener?.(proposal)

            expect(requestBottomSheet).toHaveBeenCalledTimes(1)
            expect(requestBottomSheet).toHaveBeenCalledWith(
                expect.objectContaining({
                    options: expect.objectContaining({
                        size: 'modal',
                        enableCloseOnBackdropPress: false,
                    }),
                }),
            )
        })

        // The peer's handshake expires long before a queued approval reaches
        // the screen; approving it could only fake-succeed.
        it('rejects a queued proposal that expired while waiting, and never opens it', async () => {
            renderHook(() => useConnectionsProvider())
            proposalSubscription.listener?.(makeProposal('p1'))
            const expired = { ...makeProposal('p2'), expiresAt: Date.now() - 1 }
            proposalSubscription.listener?.(expired)
            const wrapped = wrappedProposalFrom(
                requestBottomSheet.mock.calls[0],
            )

            await wrapped.reject('user cancelled')
            await flush()

            expect(expired.reject).toHaveBeenCalledWith('expired')
            expect(requestBottomSheet).toHaveBeenCalledTimes(1)
        })

        it('queues a second proposal instead of opening a second sheet over the first', () => {
            renderHook(() => useConnectionsProvider())

            proposalSubscription.listener?.(makeProposal('p1'))
            proposalSubscription.listener?.(makeProposal('p2'))

            // The guard is what's under test — p2 must not have requested a
            // sheet of its own while p1's is still open.
            expect(requestBottomSheet).toHaveBeenCalledTimes(1)
        })

        it('dismisses and opens the next queued proposal once approve succeeds', async () => {
            renderHook(() => useConnectionsProvider())
            const first = makeProposal('p1')
            const second = makeProposal('p2')

            proposalSubscription.listener?.(first)
            proposalSubscription.listener?.(second)
            const wrapped = wrappedProposalFrom(
                requestBottomSheet.mock.calls[0],
            )

            await wrapped.approve(['AAAA'])
            await flush()

            expect(first.approve).toHaveBeenCalledWith(['AAAA'])
            expect(dismissBottomSheet).toHaveBeenCalledTimes(1)
            // p1's success sheet, then the queued p2 — mirroring the legacy
            // provider, which read the next entry off `sessionRequests` only
            // once the success sheet had settled.
            expect(requestBottomSheet).toHaveBeenCalledTimes(3)
            expect(
                wrappedProposalFrom(requestBottomSheet.mock.calls[2])
                    .proposalId,
            ).toBe('p2')
        })

        it('shows the success sheet for the approved connection', async () => {
            renderHook(() => useConnectionsProvider())
            proposalSubscription.listener?.(makeProposal('p1'))
            const wrapped = wrappedProposalFrom(
                requestBottomSheet.mock.calls[0],
            )

            await wrapped.approve(['AAAA'])

            expect(requestBottomSheet).toHaveBeenCalledTimes(2)
            expect(requestBottomSheet.mock.calls[1][0]).toMatchObject({
                options: { size: 'auto', enablePanDownToClose: true },
            })
        })

        // The handler writes the origin at approval (it travelled with
        // `pair`), so the record itself says whether the dApp is right behind
        // the sheet host.
        it('skips the success sheet for a connection the handler recorded as in-app', async () => {
            renderHook(() => useConnectionsProvider())
            const proposal = makeProposal('p1')
            proposal.approve.mockResolvedValue({
                id: 'p1',
                kind: 'walletconnect-v1',
                name: 'dApp',
                peer: { name: 'dApp' },
                accounts: ['AAAA'],
                status: 'active',
                createdAt: 0,
                lastActiveAt: 0,
                origin: { source: 'in-app' },
            })
            proposalSubscription.listener?.(proposal)
            const wrapped = wrappedProposalFrom(
                requestBottomSheet.mock.calls[0],
            )

            const approved = await wrapped.approve(['AAAA'])

            expect(approved.origin?.source).toBe('in-app')
            expect(requestBottomSheet).toHaveBeenCalledTimes(1)
        })

        it('always dismisses on reject, even when peer delivery fails', async () => {
            renderHook(() => useConnectionsProvider())
            const proposal = makeProposal('p1')
            proposal.reject.mockRejectedValue(new Error('dead socket'))

            proposalSubscription.listener?.(proposal)
            const wrapped = wrappedProposalFrom(
                requestBottomSheet.mock.calls[0],
            )

            // Mirrors `ConnectionView`'s Cancel button: the sheet closes
            // locally even when notifying the peer fails, so the caller's
            // rejection is expected here, not swallowed by this test.
            await expect(wrapped.reject('user cancelled')).rejects.toThrow(
                'dead socket',
            )

            expect(dismissBottomSheet).toHaveBeenCalledTimes(1)
        })

        it('does not dismiss when approve fails — the sheet stays open so Connect can be retried', async () => {
            renderHook(() => useConnectionsProvider())
            const proposal = makeProposal('p1')
            proposal.approve.mockRejectedValue(new Error('delivery failed'))

            proposalSubscription.listener?.(proposal)
            const wrapped = wrappedProposalFrom(
                requestBottomSheet.mock.calls[0],
            )

            await expect(wrapped.approve(['AAAA'])).rejects.toThrow(
                'delivery failed',
            )

            expect(dismissBottomSheet).not.toHaveBeenCalled()
            // Nothing settled, so no queued proposal should have opened
            // either — there wasn't one, but the guard must still be held.
            expect(requestBottomSheet).toHaveBeenCalledTimes(1)
        })

        it('releases the guard and opens the next proposal when the sheet fails to mount', async () => {
            requestBottomSheet.mockImplementationOnce(() =>
                Promise.reject(new Error('no BottomSheetManager host')),
            )
            renderHook(() => useConnectionsProvider())

            proposalSubscription.listener?.(makeProposal('p1'))
            proposalSubscription.listener?.(makeProposal('p2'))
            // Let the rejected `request()` promise's `.catch` run.
            await flush()

            // p1 failed to mount at all — nothing to dismiss — but the guard
            // must still have released so p2 (queued behind it) gets its own
            // attempt rather than being wedged behind a proposal that can
            // never show.
            expect(dismissBottomSheet).not.toHaveBeenCalled()
            expect(requestBottomSheet).toHaveBeenCalledTimes(2)
            expect(
                wrappedProposalFrom(requestBottomSheet.mock.calls[1])
                    .proposalId,
            ).toBe('p2')
        })

        it('does not let a stale settle from an already-settled proposal dismiss a since-opened queued one', async () => {
            renderHook(() => useConnectionsProvider())
            const first = makeProposal('p1')
            const second = makeProposal('p2')

            proposalSubscription.listener?.(first)
            proposalSubscription.listener?.(second)
            const wrappedFirst = wrappedProposalFrom(
                requestBottomSheet.mock.calls[0],
            )

            // A double-tapped Cancel, or two in-flight reject calls racing,
            // settles the SAME (p1) proposal twice. The first legitimately
            // dismisses p1 and opens p2; the second is stale and must be a
            // no-op — it must not reach into whatever sheet is open NOW
            // (p2's) and tear it down out from under a proposal that never
            // settled.
            await Promise.all([wrappedFirst.reject(), wrappedFirst.reject()])

            expect(dismissBottomSheet).toHaveBeenCalledTimes(1)
        })

        it('never toasts a registry error message verbatim', () => {
            // `message` is developer English aimed at the remote peer and the
            // logs — it carries the validator's zod field path. Toasting it
            // put `0.txn: Invalid input` in front of the user.
            renderHook(() => useConnectionsProvider())

            errorSubscription.listener?.(
                new Error(
                    'Invalid algo_signTxn payload — 0.txn: Invalid input',
                ),
                scoped('client-1'),
            )

            const [{ body }] = showToast.mock.calls[0] as [{ body: string }]
            expect(body).not.toContain('0.txn')
        })

        it('toasts the declared messageKey copy for a typed registry error', () => {
            renderHook(() => useConnectionsProvider())

            errorSubscription.listener?.(
                new AppError('No connection handler accepts this URI', {
                    messageKey: 'errors.connections.no_handler',
                }),
                scoped('client-1'),
            )

            const [{ body }] = showToast.mock.calls[0] as [{ body: string }]
            expect(body).toBe(i18n.t('errors.connections.no_handler'))
        })

        // `useWalletConnectProvider` scoped `connectionError` to its connector
        // and removed that pending request, closing the sheet. Without this the
        // approval sheet sits over a dead connection and Connect only fails
        // with the retryable delivery toast.
        it('closes the open proposal sheet when an error arrives for its connection', () => {
            renderHook(() => useConnectionsProvider())
            proposalSubscription.listener?.(makeProposal('p1', 'client-1'))

            errorSubscription.listener?.(
                new Error('bridge died'),
                scoped('client-1'),
            )

            expect(dismissBottomSheet).toHaveBeenCalledTimes(1)
        })

        it('rejects the open proposal so the pairing is torn down, not just hidden', async () => {
            // Dismissing answers nobody: only the handler's reject path
            // unbinds the connector, and one left bound with
            // `session_request` on it pops a ghost approval sheet as soon as
            // the bridge revives.
            renderHook(() => useConnectionsProvider())
            const proposal = makeProposal('p1', 'client-1')
            proposalSubscription.listener?.(proposal)

            errorSubscription.listener?.(
                new Error('bridge died'),
                scoped('client-1'),
            )
            await flush()

            expect(proposal.reject).toHaveBeenCalled()
        })

        it('does not toast twice when that rejection cannot reach the dead peer', async () => {
            // The socket that failed is the one being answered, so the
            // rejection's own delivery failure comes back through this same
            // error channel. The user has already been told once.
            renderHook(() => useConnectionsProvider())
            const proposal = makeProposal('p1', 'client-1')
            proposal.reject.mockImplementation(async () => {
                errorSubscription.listener?.(
                    new Error('reject delivery failed'),
                    scoped('client-1'),
                )
            })
            proposalSubscription.listener?.(proposal)

            errorSubscription.listener?.(
                new Error('bridge died'),
                scoped('client-1'),
            )
            await flush()

            expect(showToast).toHaveBeenCalledTimes(1)
        })

        // v1 gives a pairing and the session it becomes the same id; v2's
        // pairing topic is not its session topic. The sheet on screen after
        // approval belongs to the CONNECTION, so that is the scope an error
        // about it carries — and "connected!" must not sit over a session
        // that has already died.
        it('closes the connected sheet when an error names the connection the pairing became', async () => {
            renderHook(() => useConnectionsProvider())
            proposalSubscription.listener?.(makeProposal('session-1', 'pair-1'))
            const wrapped = wrappedProposalFrom(
                requestBottomSheet.mock.calls[0],
            )
            // The success sheet stays open until dismissed, as it does in the
            // app; the default mock resolves at once and would close it.
            requestBottomSheet.mockReturnValueOnce(new Promise(() => {}))

            await wrapped.approve(['AAAA'])
            await flush()
            expect(dismissBottomSheet).toHaveBeenCalledTimes(1)

            errorSubscription.listener?.(new Error('bridge died'), {
                connectionId: 'session-1',
            })

            expect(dismissBottomSheet).toHaveBeenCalledTimes(2)
        })

        it('leaves the approval sheet alone for an error about a session rather than its pairing', () => {
            renderHook(() => useConnectionsProvider())
            proposalSubscription.listener?.(makeProposal('p1', 'pair-1'))

            errorSubscription.listener?.(new Error('delivery failed'), {
                connectionId: 'session-1',
            })

            expect(dismissBottomSheet).not.toHaveBeenCalled()
        })

        it('does not toast twice when the rejection fails under the connection scope', async () => {
            // Same suppression as above, one scope over: v1 reports a failure
            // as the CONNECTION's once the connector has flipped to connected.
            renderHook(() => useConnectionsProvider())
            const proposal = makeProposal('p1', 'client-1')
            proposal.reject.mockImplementation(async () => {
                errorSubscription.listener?.(
                    new Error('reject delivery failed'),
                    { connectionId: 'client-1' },
                )
            })
            proposalSubscription.listener?.(proposal)

            errorSubscription.listener?.(
                new Error('bridge died'),
                scoped('client-1'),
            )
            await flush()

            expect(showToast).toHaveBeenCalledTimes(1)
        })

        it('leaves another connection open proposal alone', () => {
            renderHook(() => useConnectionsProvider())
            proposalSubscription.listener?.(makeProposal('p1', 'client-1'))

            errorSubscription.listener?.(
                new Error('bridge died'),
                scoped('client-2'),
            )

            expect(dismissBottomSheet).not.toHaveBeenCalled()
        })

        it('drops queued proposals for the errored connection instead of opening them', () => {
            renderHook(() => useConnectionsProvider())
            proposalSubscription.listener?.(makeProposal('p1', 'client-1'))
            proposalSubscription.listener?.(makeProposal('p2', 'client-1'))
            proposalSubscription.listener?.(makeProposal('p3', 'client-9'))

            errorSubscription.listener?.(
                new Error('bridge died'),
                scoped('client-1'),
            )

            // p1's sheet closed, p2 died with it, and p3 — a different
            // connection — takes its turn rather than being discarded.
            expect(requestBottomSheet).toHaveBeenCalledTimes(2)
            expect(
                wrappedProposalFrom(requestBottomSheet.mock.calls[1])
                    .proposalId,
            ).toBe('p3')
        })

        it('rejects the open and every queued proposal when the provider tears down', async () => {
            const { unmount } = renderHook(() => useConnectionsProvider())
            const first = makeProposal('p1')
            const second = makeProposal('p2')
            const third = makeProposal('p3')

            proposalSubscription.listener?.(first)
            proposalSubscription.listener?.(second)
            proposalSubscription.listener?.(third)

            unmount()
            await flush()

            // p1 was on screen, p2 and p3 were only queued — none of them
            // got an explicit user answer, so all three must be told the
            // peer will never hear back, rather than being dropped for the
            // dApp to time out against silently.
            expect(first.reject).toHaveBeenCalled()
            expect(second.reject).toHaveBeenCalled()
            expect(third.reject).toHaveBeenCalled()
        })
    })
})
