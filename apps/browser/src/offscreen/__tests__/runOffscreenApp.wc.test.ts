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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WcHostDeps } from '../walletconnect/wcHost'

// Every dependency below is captured through `vi.hoisted` so the mock
// factories (which vitest hoists above these imports) and the assertions
// in each test share the same function identities.
const {
    startWcHost,
    onWcControlMessage,
    onLocalStorageKeyChanged,
    sendWcApprovalRequest,
    sendPairOutcome,
    createWalletConnectConnector,
    accountsGetState,
    networkGetState,
    walletConnectGetState,
    setWalletConnectConnections,
    walletConnectHasHydrated,
    walletConnectOnFinishHydration,
    walletConnectSubscribe,
    sendWcErrorNotice,
} = vi.hoisted(() => {
    const setWalletConnectConnections = vi.fn()
    return {
        startWcHost: vi.fn((_deps: WcHostDeps) => ({
            handleControlMessage: vi.fn(),
            reviveStoredSessions: vi.fn(),
        })),
        onWcControlMessage: vi.fn(),
        onLocalStorageKeyChanged: vi.fn(),
        sendWcApprovalRequest: vi.fn(),
        sendPairOutcome: vi.fn(),
        createWalletConnectConnector: vi.fn(),
        accountsGetState: vi.fn(),
        networkGetState: vi.fn(),
        walletConnectGetState: vi.fn(),
        setWalletConnectConnections,
        // Default: already hydrated, matching every existing test's
        // synchronous "revives immediately" expectation. The
        // hydration-gating tests below override this to exercise the
        // async-hydration gate.
        walletConnectHasHydrated: vi.fn(() => true),
        walletConnectOnFinishHydration: vi.fn((_listener: () => void) =>
            vi.fn(),
        ),
        walletConnectSubscribe: vi.fn(),
        sendWcErrorNotice: vi.fn(),
    }
})

vi.mock('../walletconnect/wcHost', () => ({ startWcHost }))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    createWorkerExecutor: vi.fn(() => ({ onDeath: vi.fn() })),
    onLocalStorageKeyChanged,
    startDatabaseHost: vi.fn(() => ({ setReady: vi.fn() })),
    onWcControlMessage,
    sendWcApprovalRequest,
    sendPairOutcome,
    sendWcErrorNotice,
}))
vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    getPlatformServices: vi.fn(() => ({ database: {} })),
}))
vi.mock('@perawallet/wallet-core-database', () => ({
    getDatabase: vi.fn(),
    initializeDatabase: vi.fn().mockResolvedValue(undefined),
}))
// The real `@providers/QueryProvider` module pulls in `query-persistence.ts`,
// which drags `@perawallet/wallet-core-transactions` and
// `@perawallet/wallet-core-card` into the import graph purely for its
// dehydrate-allowlist predicates — several package-deep transitive imports
// this coarse wiring test has no reason to exercise (one of them,
// wallet-core-card, resolves to a stale workspace `dist` build that fails
// to import in this test project). `initializeSyncService` is already
// mocked below, so `queryClient` only needs to be *some* object reference.
vi.mock('@providers/QueryProvider', () => ({ queryClient: {} }))
vi.mock('@perawallet/wallet-core-assets', () => ({
    seedAlgoAsset: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: vi.fn(() => ({ start: vi.fn() })),
    initializeSyncService: vi.fn(),
}))
// `useAccountsStore`/`useNetworkStore`/`usePollingStore`/`useWalletConnectStore`
// are only ever read through `.getState()` (deps closures) or stashed as
// `REHYDRATE_BY_KEY` values (read only via `.persist.rehydrate()`, never
// invoked by this coarse wiring test) — never destructured with the
// selector-hook calling convention the app-wide `vitest.setup.ts` mock
// uses for `useAccountsStore`. That global mock has no `.getState`, so it
// is overridden here with the real accessor shape these deps rely on.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: accountsGetState,
        persist: { rehydrate: vi.fn() },
    },
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: {
        getState: networkGetState,
        persist: { rehydrate: vi.fn() },
    },
    // Only ever stashed in REHYDRATE_BY_KEY — no accessor needed, but the
    // export must exist or the module-level table throws on import.
    useCustomNetworkStore: {
        persist: { rehydrate: vi.fn() },
    },
}))
vi.mock('@perawallet/wallet-core-polling', () => ({
    usePollingStore: { persist: { rehydrate: vi.fn() } },
}))
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    createWalletConnectConnector,
    getConnectionErrorClientId: (error: { clientId?: string }) =>
        error.clientId ?? null,
    useWalletConnectStore: {
        getState: walletConnectGetState,
        // The host forwards connector failures to the UI over the
        // wc-error-notice broadcast; capture the listener so that path can be
        // driven directly.
        subscribe: walletConnectSubscribe,
        persist: {
            rehydrate: vi.fn(),
            hasHydrated: walletConnectHasHydrated,
            onFinishHydration: walletConnectOnFinishHydration,
        },
    },
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER: 'fee-adjusted',
    FeeAdjustmentDeliveryError: class FeeAdjustmentDeliveryError extends Error {},
}))

describe('runOffscreenApp WC wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('Worker', vi.fn())
        accountsGetState.mockReturnValue({
            accounts: [{ address: 'ADDR1' }, { address: 'ADDR2' }],
        })
        networkGetState.mockReturnValue({ network: 'mainnet' })
        walletConnectGetState.mockReturnValue({
            walletConnectConnections: [],
            setWalletConnectConnections,
            // Cleared after each failure is broadcast, so a settled error is
            // never re-announced to the next subscriber.
            setConnectionError: vi.fn(),
        })
    })

    it('starts the WC host, subscribes to control messages, and revives sessions', async () => {
        const { runOffscreenApp } = await import('../runOffscreenApp')

        await runOffscreenApp()

        expect(startWcHost).toHaveBeenCalledTimes(1)
        expect(onWcControlMessage).toHaveBeenCalledTimes(1)
        const host = startWcHost.mock.results[0]?.value as {
            reviveStoredSessions: ReturnType<typeof vi.fn>
        }
        expect(host.reviveStoredSessions).toHaveBeenCalledTimes(1)
    })

    it('wires network/knownAddresses/storedConnections to the real store accessors', async () => {
        const { runOffscreenApp } = await import('../runOffscreenApp')

        await runOffscreenApp()

        const deps = startWcHost.mock.calls[0]?.[0] as WcHostDeps
        expect(deps.network()).toBe('mainnet')
        expect(deps.knownAddresses()).toEqual(['ADDR1', 'ADDR2'])
        expect(deps.storedConnections()).toEqual([])
    })

    it('injects the cross-package connector factory rather than constructing the SDK locally', async () => {
        const { runOffscreenApp } = await import('../runOffscreenApp')

        await runOffscreenApp()

        const deps = startWcHost.mock.calls[0]?.[0] as WcHostDeps
        expect(deps.createConnector).toBe(createWalletConnectConnector)
        expect(deps.requestApproval).toBe(sendWcApprovalRequest)
    })

    it('injects the platform-chrome pair-outcome sender rather than reaching for chrome.runtime locally', async () => {
        const { runOffscreenApp } = await import('../runOffscreenApp')

        await runOffscreenApp()

        const deps = startWcHost.mock.calls[0]?.[0] as WcHostDeps
        expect(deps.sendPairOutcome).toBe(sendPairOutcome)
    })

    it('registers the WC store for cross-context rehydration under its real kv: persisted key', async () => {
        const { runOffscreenApp } = await import('../runOffscreenApp')

        await runOffscreenApp()

        expect(onLocalStorageKeyChanged).toHaveBeenCalledWith(
            expect.arrayContaining(['kv:wallet-connect-store']),
            expect.any(Function),
        )
    })

    it('persistConnection replaces any existing record for the same clientId in the WC store', async () => {
        walletConnectGetState.mockReturnValue({
            walletConnectConnections: [
                { clientId: 'client-1', session: { peerId: 'old' } },
                { clientId: 'client-2', session: { peerId: 'keep' } },
            ],
            setWalletConnectConnections,
        })
        const { runOffscreenApp } = await import('../runOffscreenApp')
        await runOffscreenApp()

        const deps = startWcHost.mock.calls[0]?.[0] as WcHostDeps
        const replacement = {
            clientId: 'client-1',
            session: { peerId: 'new' },
        } as unknown as ReturnType<WcHostDeps['storedConnections']>[number]
        deps.persistConnection(replacement)

        expect(setWalletConnectConnections).toHaveBeenCalledWith([
            { clientId: 'client-2', session: { peerId: 'keep' } },
            replacement,
        ])
    })

    it('removeConnection drops the record for the given clientId from the WC store', async () => {
        walletConnectGetState.mockReturnValue({
            walletConnectConnections: [
                { clientId: 'client-1' },
                { clientId: 'client-2' },
            ],
            setWalletConnectConnections,
        })
        const { runOffscreenApp } = await import('../runOffscreenApp')
        await runOffscreenApp()

        const deps = startWcHost.mock.calls[0]?.[0] as WcHostDeps
        deps.removeConnection('client-1')

        expect(setWalletConnectConnections).toHaveBeenCalledWith([
            { clientId: 'client-2' },
        ])
    })

    describe('revival is gated on WC-store hydration', () => {
        it('revives immediately when the WC store is already hydrated', async () => {
            walletConnectHasHydrated.mockReturnValue(true)
            const { runOffscreenApp } = await import('../runOffscreenApp')

            await runOffscreenApp()

            const host = startWcHost.mock.results[0]?.value as {
                reviveStoredSessions: ReturnType<typeof vi.fn>
            }
            expect(host.reviveStoredSessions).toHaveBeenCalledTimes(1)
            expect(walletConnectOnFinishHydration).not.toHaveBeenCalled()
        })

        it('defers revival until hydration finishes, rather than reading an empty store', async () => {
            walletConnectHasHydrated.mockReturnValue(false)
            let finishHydration: (() => void) | undefined
            walletConnectOnFinishHydration.mockImplementation(
                (listener: () => void) => {
                    finishHydration = listener
                    return vi.fn()
                },
            )
            const { runOffscreenApp } = await import('../runOffscreenApp')

            await runOffscreenApp()

            const host = startWcHost.mock.results[0]?.value as {
                reviveStoredSessions: ReturnType<typeof vi.fn>
            }
            // Not hydrated yet: revival must not have run off an empty
            // store — nothing else in this document's lifetime retries.
            expect(host.reviveStoredSessions).not.toHaveBeenCalled()

            finishHydration?.()

            expect(host.reviveStoredSessions).toHaveBeenCalledTimes(1)
        })
    })

    it('removeConnection skips the store write when no record matches the clientId', async () => {
        walletConnectGetState.mockReturnValue({
            walletConnectConnections: [{ clientId: 'client-2' }],
            setWalletConnectConnections,
        })
        const { runOffscreenApp } = await import('../runOffscreenApp')
        await runOffscreenApp()

        const deps = startWcHost.mock.calls[0]?.[0] as WcHostDeps
        // A wrong-network auto-reject or a disconnect for a clientId that
        // was never paired hits this on every occurrence — it must not
        // write the store (and trigger the chrome.storage write + SW-
        // relayed cross-context rehydrate that follows) for a no-op.
        deps.removeConnection('never-paired')

        expect(setWalletConnectConnections).not.toHaveBeenCalled()
    })

    // On web the connector lives here, and `connectionError` is not persisted
    // (the store's partialize keeps only walletConnectConnections), so the UI
    // realm never saw wrong-network / rejected / expired handshakes at all.
    describe('connector failures reaching the UI', () => {
        const emitError = async (
            error: Error & { clientId?: string },
        ): Promise<void> => {
            const { runOffscreenApp } = await import('../runOffscreenApp')
            await runOffscreenApp()
            const listener = walletConnectSubscribe.mock.calls.at(-1)?.[0] as (
                state: unknown,
                previous: unknown,
            ) => void
            listener({ connectionError: error }, { connectionError: null })
        }

        it('broadcasts the failure to UI realms', async () => {
            const error = Object.assign(new Error('Wrong network'), {
                clientId: 'client-9',
            })

            await emitError(error)

            expect(sendWcErrorNotice).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Wrong network',
                    clientId: 'client-9',
                }),
            )
        })

        // Otherwise the store keeps a settled error that the next subscriber
        // would re-announce as if it had just happened.
        it('clears the error after broadcasting it', async () => {
            const setConnectionError = vi.fn()
            walletConnectGetState.mockReturnValue({
                setWalletConnectConnections,
                walletConnectConnections: [],
                setConnectionError,
            })

            await emitError(new Error('boom'))

            expect(setConnectionError).toHaveBeenCalledWith(null)
        })

        it('ignores an unchanged error so one failure is announced once', async () => {
            const { runOffscreenApp } = await import('../runOffscreenApp')
            await runOffscreenApp()
            const listener = walletConnectSubscribe.mock.calls.at(-1)?.[0] as (
                state: unknown,
                previous: unknown,
            ) => void
            const same = new Error('same')

            listener({ connectionError: same }, { connectionError: same })

            expect(sendWcErrorNotice).not.toHaveBeenCalled()
        })
    })
})
