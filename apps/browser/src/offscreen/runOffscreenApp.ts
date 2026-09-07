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

// The offscreen document is the DB host: it owns the sqlite worker, runs
// migrations before serving any proxy exec, and keeps slow warm polling alive
// between popup opens.
import {
    broadcastConnectionsEvent,
    createWorkerExecutor,
    onConnectionsControlMessage,
    onLocalStorageKeyChanged,
    sendConnectionApprovalRequest,
    startDatabaseHost,
} from '@perawallet/wallet-extension-platform-chrome'
import { getPlatformServices } from '@perawallet/wallet-extension-platform-driver'
import { getProvider } from '@perawallet/wallet-extension-provider'
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
import {
    bootConnections,
    createConnectionRegistry,
} from '@perawallet/wallet-core-connections'
import { usePollingStore } from '@perawallet/wallet-core-polling'
import {
    createStorageSessionKeyStore,
    createWalletConnectV1Handler,
    importLegacyConnections,
    reconnectAllConnectors,
} from '@perawallet/wallet-core-walletconnect'
import { logger } from '@perawallet/wallet-core-shared'
import { queryClient } from '@providers/queryClient'
import { startConnectionsHost } from './connections/connectionsHost'

const OFFSCREEN_POLL_INTERVAL_MS = 30_000

// zustand persist hydrates once at import and this context is long-lived, so
// writes from other contexts must be re-read. Keys are `kv:` + STORE_NAME.
// custom-network-store must stay paired with network-store: rehydration demotes
// a persisted `custom` to config.defaultNetwork when the custom slot has no config.
const REHYDRATE_BY_KEY: Record<
    string,
    { persist: { rehydrate: () => unknown } }
> = {
    'kv:accounts-store': useAccountsStore,
    'kv:custom-network-store': useCustomNetworkStore,
    'kv:network-store': useNetworkStore,
    'kv:polling-store': usePollingStore,
}

export const runOffscreenApp = async (): Promise<void> => {
    const services = getPlatformServices()

    const worker = new Worker('db-worker.js', { type: 'module' })
    const executor = createWorkerExecutor(worker)
    const host = startDatabaseHost(executor)

    // Nothing recreates a dead worker in place. Closing the document makes
    // hasDocument() false, so the next ensure-offscreen recreates it and reruns
    // this bootstrap (migrations are tag-idempotent).
    executor.onDeath?.(error => {
        logger.error(
            '[offscreen] db worker died, closing offscreen document for recreation',
            {
                error,
            },
        )
        window.close()
    })

    // Migrations run before the host answers ready to anyone.
    await initializeDatabase(services.database)
    await seedAlgoAsset(getDatabase())
    host.setReady()

    // chrome.storage here is the SW-proxied shim (offscreen docs have none), and
    // apps/mobile compiles without chrome ambient types, so the raw onChanged
    // listener lives in platform-chrome.
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

    // Offscreen outlives every UI surface, so it owns the handlers and their
    // sockets. Its provider engine has no key source and cannot open sealed
    // material, so session keys are storage-backed and boot never awaits one.
    const provider = getProvider()
    const store = provider.connections.store
    const storage = provider.keyValueStorage
    const sessionKeys = createStorageSessionKeyStore(storage)
    const registry = createConnectionRegistry({ store })
    registry.register(
        createWalletConnectV1Handler({
            getNetwork: () => useNetworkStore.getState().network,
            sessionKeys,
        }),
    )
    const connectionsHost = startConnectionsHost({
        registry,
        network: () => useNetworkStore.getState().network,
        knownAddresses: () =>
            useAccountsStore
                .getState()
                .accounts.map(account => account.address),
        requestApproval: sendConnectionApprovalRequest,
        broadcastEvent: broadcastConnectionsEvent,
        reconnectAll: reconnectAllConnectors,
    })
    onConnectionsControlMessage(connectionsHost.handleControlMessage)
    await bootConnections({
        registry,
        store,
        keystoreReady: Promise.resolve(),
        importLegacy: () =>
            importLegacyConnections({ storage, store, sessionKeys }),
    })

    logger.info('[offscreen] connections host started')
}
