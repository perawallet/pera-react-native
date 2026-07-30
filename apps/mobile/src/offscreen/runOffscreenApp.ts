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

// Headless bootstrap for the 'offscreen' surface. This context is the DB
// host: it owns the sqlite worker, runs migrations BEFORE serving any proxy
// exec (single migration runner by construction), and keeps a slow warm-poll
// SyncService alive so a freshly opened popup shows warm data (design spec:
// "the offscreen document keeps light polling alive between popup opens").
import {
    createWorkerExecutor,
    onLocalStorageKeyChanged,
    onWcControlMessage,
    sendPairOutcome,
    sendWcApprovalRequest,
    startDatabaseHost,
} from '@perawallet/wallet-extension-platform-chrome'
import { getPlatformServices } from '@perawallet/wallet-extension-platform-driver'
import {
    getDatabase,
    initializeDatabase,
} from '@perawallet/wallet-core-database'
import { seedAlgoAsset } from '@perawallet/wallet-core-assets'
import {
    getSyncService,
    initializeSyncService,
} from '@perawallet/wallet-core-background'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    useCustomNetworkStore,
    useNetworkStore,
} from '@perawallet/wallet-core-blockchain'
import { usePollingStore } from '@perawallet/wallet-core-polling'
import {
    createWalletConnectConnector,
    useWalletConnectStore,
} from '@perawallet/wallet-core-walletconnect'
import { logger } from '@perawallet/wallet-core-shared'
import { queryClient } from '@providers/QueryProvider'
import { startWcHost } from './walletconnect/wcHost'

const OFFSCREEN_POLL_INTERVAL_MS = 30_000

// This context is long-lived while UI contexts are ephemeral: zustand persist
// hydrates once at import, so cross-context writes (onboarding an account in
// the expanded tab) must be re-read explicitly. Keys are `kv:` +
// STORE_NAME from each package's store.ts.
// The custom-network entry must be here alongside the network entry, and the
// popup's save order (config first, then the switch — see useCustomNetworkSheet)
// is what makes the pair land in the right order: network-store's rehydration
// demotes a persisted `custom` back to config.defaultNetwork when the custom
// slot has no config, so re-reading the network without re-reading its config
// would drop a perfectly valid custom selection here.
const REHYDRATE_BY_KEY: Record<
    string,
    { persist: { rehydrate: () => unknown } }
> = {
    'kv:accounts-store': useAccountsStore,
    'kv:custom-network-store': useCustomNetworkStore,
    'kv:network-store': useNetworkStore,
    'kv:polling-store': usePollingStore,
    'kv:wallet-connect-store': useWalletConnectStore,
}

export const runOffscreenApp = async (): Promise<void> => {
    const services = getPlatformServices()

    const worker = new Worker('db-worker.js', { type: 'module' })
    const executor = createWorkerExecutor(worker)
    const host = startDatabaseHost(executor)

    // An unrecoverable worker crash (see worker-executor's error/messageerror
    // handling) flips the host un-ready (host.ts), but nothing recreates the
    // worker in this same document — there's no code path to re-run
    // migrations against a fresh worker in place. Self-closing instead makes
    // chrome.offscreen.hasDocument() report false, so the next
    // ensure-offscreen request (from ChromeDatabaseService's
    // ensureHostAvailable retry loop) creates a brand-new offscreen document
    // that reruns this bootstrap — migrations are tag-idempotent, so re-run
    // is safe.
    executor.onDeath?.(error => {
        logger.error(
            '[offscreen] db worker died, closing offscreen document for recreation',
            {
                error,
            },
        )
        window.close()
    })

    // Local execution path (host is active in this context): migrations run
    // here, before the host answers ready to anyone else.
    await initializeDatabase(services.database)
    await seedAlgoAsset(getDatabase())
    host.setReady()

    // NOTE: in the offscreen document chrome.storage is the SW-proxied shim
    // (installOffscreenStorageShim in App.web.tsx) — offscreen docs have no
    // native chrome.storage; onChanged events arrive relayed from the SW.
    // apps/mobile compiles without chrome ambient types, so the raw
    // chrome.storage.onChanged listener lives behind this platform-chrome helper.
    onLocalStorageKeyChanged(
        Object.keys(REHYDRATE_BY_KEY),
        key => void REHYDRATE_BY_KEY[key]?.persist.rehydrate(),
    )

    initializeSyncService({
        queryClient,
        pollIntervalMs: OFFSCREEN_POLL_INTERVAL_MS,
    })
    getSyncService().start()
    logger.info('[offscreen] database host ready, warm polling started')

    // The offscreen document is the long-lived WC v1 socket owner (see
    // module doc comment in wcHost.ts): a session paired or revived here
    // keeps its bridge socket open after the popup that initiated it
    // closes. Signing never happens in this context — the vault is
    // deliberately absent — so gate survivors are forwarded to the service
    // worker via `sendWcApprovalRequest`, which opens an approval surface.
    const wcHost = startWcHost({
        network: () => useNetworkStore.getState().network,
        knownAddresses: () =>
            useAccountsStore
                .getState()
                .accounts.map(account => account.address),
        // `walletConnectConnections` is typed as a non-nullable array with
        // an empty-array default (packages/walletconnect/src/store/store.ts)
        // — never `??`'d here, and `persistConnection`/`removeConnection`
        // below trust the same guarantee rather than defending against a
        // shape the type already rules out.
        storedConnections: () =>
            useWalletConnectStore.getState().walletConnectConnections,
        requestApproval: sendWcApprovalRequest,
        sendPairOutcome,
        createConnector: createWalletConnectConnector,
        persistConnection: connection => {
            const { walletConnectConnections, setWalletConnectConnections } =
                useWalletConnectStore.getState()
            setWalletConnectConnections([
                ...walletConnectConnections.filter(
                    conn => conn.clientId !== connection.clientId,
                ),
                connection,
            ])
        },
        removeConnection: clientId => {
            const { walletConnectConnections, setWalletConnectConnections } =
                useWalletConnectStore.getState()
            // A wrong-network auto-reject or a disconnect for a clientId
            // that was never paired hits this on every occurrence — skip
            // the store write (and the chrome.storage write + cross-context
            // rehydrate it would otherwise trigger) when there is nothing
            // to remove.
            if (
                !walletConnectConnections.some(
                    conn => conn.clientId === clientId,
                )
            ) {
                return
            }
            setWalletConnectConnections(
                walletConnectConnections.filter(
                    conn => conn.clientId !== clientId,
                ),
            )
        },
    })
    onWcControlMessage(wcHost.handleControlMessage)

    // `useWalletConnectStore`'s `persist` hydrates asynchronously over the
    // SW-proxied chrome.storage adapter (see `REHYDRATE_BY_KEY`'s comment
    // above) — a boot reaching this line (e.g. the heartbeat re-ensuring a
    // freshly (re)created offscreen document) can beat that hydration.
    // Reviving before it lands would read `storedConnections()` as `[]`
    // and nothing here ever retries: the heartbeat's own `reconnect-all`
    // control message only sweeps connectors already IN the registry
    // (`reconnectAllConnectors`), and no UI realm owns connectors anymore
    // to fall back on. Every persisted session would be silently dead for
    // this offscreen document's whole lifetime.
    //
    // Same `hasHydrated()`/`onFinishHydration` gate as
    // `useSignRequestApprovalScreen.ts`'s wc-sign branch (read its doc
    // comment for the full rationale). That call site is a React effect
    // and must re-check `hasHydrated()` immediately after subscribing to
    // close a scheduling gap between render and effect execution; this is
    // one synchronous function body with no such gap between the check and
    // the subscribe below, so no re-check is needed here — but the
    // subscription itself still unsubscribes after its first fire, since
    // `onFinishHydration` re-fires on every later `rehydrate()` call (e.g.
    // this same document's own `onLocalStorageKeyChanged` cross-context
    // listener), and revival is a one-shot boot action.
    if (useWalletConnectStore.persist.hasHydrated()) {
        wcHost.reviveStoredSessions()
    } else {
        const unsubscribe = useWalletConnectStore.persist.onFinishHydration(
            () => {
                unsubscribe()
                wcHost.reviveStoredSessions()
            },
        )
    }
    logger.info('[offscreen] WalletConnect host started')
}
