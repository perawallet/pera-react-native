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
import { startDatabaseHost } from '@perawallet/wallet-extension-platform-chrome'
import {
    broadcastConnectionsEvent,
    createChromeDappTransport,
    onConnectionsControlMessage,
    onLocalStorageKeyChanged,
    sendConnectionApprovalRequest,
} from '@perawallet/wallet-core-browser-runtime'
import { getPlatformServices } from '@perawallet/wallet-extension-platform-driver'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    getDatabase,
    initializeDatabase,
} from '@perawallet/wallet-core-database'
import { seedNativeAssets } from '@perawallet/wallet-core-assets'
import {
    createSyncStorePorts,
    getSyncService,
    initializeSyncService,
    useSyncCursorStore,
} from '@perawallet/wallet-core-background'
import {
    canSignWith,
    chainAccountOf,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import { getCustomNetworkConfig } from '@perawallet/wallet-core-chain-algorand/blockchain'
import {
    getSelectedScope,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { ALGORAND_CHAIN_ID } from '@perawallet/wallet-core-chain-algorand'
import type {
    ChainId,
    SignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    bootConnections,
    createConnectionRegistry,
    watchWalletNotices,
} from '@perawallet/wallet-core-connections'
import {
    createDappConnectionHandler,
    createEip1193ConnectionHandler,
    importLegacyDappPermissions,
    type DappAccount,
} from '@perawallet/wallet-core-dapp'
import {
    createStorageSessionKeyStore,
    createWalletConnectV1Handler,
    importLegacyConnections,
} from '@perawallet/wallet-core-walletconnect'
import { logger } from '@perawallet/wallet-core-shared'
import {
    assessSiteSafety,
    startPhishingListRefresh,
} from '@perawallet/wallet-core-site-safety'
import { queryClient } from '@providers/queryClient'
import { startConnectionsHost } from './connections/connectionsHost'
import { createDatabaseRecovery } from './databaseRecovery'
import { createWorkerExecutor } from './worker-executor'

const OFFSCREEN_POLL_INTERVAL_MS = 30_000

// Read on every answer, so a deleted or demoted account drops out at once.
const signingDappAccountsOn = (chainId: ChainId): DappAccount[] => {
    const { accounts } = useAccountsStore.getState()
    return accounts.flatMap(account => {
        const address = chainAccountOf(account, chainId)?.address
        return address && canSignWith(account, accounts, chainId)
            ? [{ address, name: account.name ?? address }]
            : []
    })
}

const addressesOn = (chainIds: readonly ChainId[]): string[] =>
    useAccountsStore.getState().accounts.flatMap(account =>
        chainIds.flatMap(chainId => {
            const address = chainAccountOf(account, chainId)?.address
            return address ? [address] : []
        }),
    )

// Each store hydrates once (the accounts store when registerChainAdapters has
// registered the chains, writing nothing before then; the others at import)
// and this context is long-lived, so writes from other contexts must be
// re-read. Keys are `kv:` + STORE_NAME.
const REHYDRATE_BY_KEY: Record<
    string,
    { persist: { rehydrate: () => unknown } }
> = {
    'kv:accounts-store': useAccountsStore,
    'kv:network-store': useNetworkStore,
    'kv:polling-store': useSyncCursorStore,
}

export type OffscreenAppDeps = {
    // Handed over by the web shell: apps/browser imports no apps/mobile code but the query client.
    registerChainAdapters: () => void
    onDatabaseReset: () => Promise<void>
    /** The broadcaster registry lives in the signing package, which apps/browser doesn't import. */
    submitSignedTransactions: (signed: SignedTransaction[]) => Promise<string[]>
}

export const runOffscreenApp = async ({
    registerChainAdapters,
    onDatabaseReset,
    submitSignedTransactions,
}: OffscreenAppDeps): Promise<void> => {
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

    // In-memory only, so it can go first. The seed below reads the native
    // asset from the chain adapter; sync's first tick reads the chain kill
    // switch, and the dApp handler refuses a chain that has no adapter.
    registerChainAdapters()

    // Migrations run before the host answers ready to anyone.
    await initializeDatabase(services.database, {
        recovery: createDatabaseRecovery(onDatabaseReset),
    })
    await seedNativeAssets(getDatabase())
    host.setReady()

    // chrome.storage here is the SW-proxied shim (offscreen docs have none), and
    // apps/mobile compiles without chrome ambient types, so the raw onChanged
    // listener lives in browser-runtime.
    onLocalStorageKeyChanged(
        Object.keys(REHYDRATE_BY_KEY),
        key => void REHYDRATE_BY_KEY[key]?.persist.rehydrate(),
    )

    initializeSyncService({
        queryClient,
        stores: createSyncStorePorts(),
        chains: getProvider().chains,
        pollIntervalMs: OFFSCREEN_POLL_INTERVAL_MS,
    })
    getSyncService().start()
    logger.info('[offscreen] database host ready, warm polling started')

    // Offscreen is the one long-lived context with the database, so it alone
    // keeps the phishing lists fresh; approval windows only read them.
    startPhishingListRefresh()

    // Offscreen outlives every UI surface, so it owns the handlers and their
    // sockets. Its provider engine has no key source and cannot open sealed
    // material, so session keys are storage-backed and boot never awaits one.
    const provider = getProvider()
    const store = provider.connections.store
    const storage = provider.keyValueStorage
    const sessionKeys = createStorageSessionKeyStore(storage)
    const registry = createConnectionRegistry({ store })
    const getNetworkId = (chainId: ChainId) =>
        getSelectedScope(chainId).networkId
    const isSiteFlagged = async (origin: string): Promise<boolean> =>
        (await assessSiteSafety({ urls: [origin] })).kind !== 'clear'
    registry.register(
        createWalletConnectV1Handler({
            chainId: ALGORAND_CHAIN_ID,
            getNetworkId,
            sessionKeys,
        }),
    )
    registry.register(
        createDappConnectionHandler({
            transport: createChromeDappTransport({ provider: 'pera' }),
            chainId: ALGORAND_CHAIN_ID,
            getNetworkId,
            getCustomNetworkGenesisHash: () =>
                getCustomNetworkConfig()?.genesisHash,
            getAccounts: () => signingDappAccountsOn(ALGORAND_CHAIN_ID),
            isSiteFlagged,
        }),
    )
    registry.register(
        createEip1193ConnectionHandler({
            transport: createChromeDappTransport({ provider: 'eip1193' }),
            getNetworkId,
            isDappConnectEnabled: chainId =>
                provider.chains.has(chainId) &&
                provider.chains.capabilities(chainId).dappConnect,
            getAccounts: signingDappAccountsOn,
            isSiteFlagged,
        }),
    )
    const connectionsHost = startConnectionsHost({
        registry,
        activeNetworkId: () => getSelectedScope(ALGORAND_CHAIN_ID).networkId,
        knownAddresses: addressesOn,
        requestApproval: sendConnectionApprovalRequest,
        broadcastEvent: broadcastConnectionsEvent,
        submitSignedTransactions,
    })
    // Bound after the registry is live, never before: the registry refuses a
    // `pair` it cannot route, and an early command answered with that error
    // would stop `sendConnectionsControlMessage` retrying across this window.
    // Unanswered is what the retry budget exists for.
    await bootConnections({
        registry,
        store,
        keystoreReady: Promise.resolve(),
        importLegacy: async () => {
            // bootConnections only catches at this boundary, so one legacy
            // importer that keeps throwing would strand the other's records
            // unmigrated on this boot and every later one.
            try {
                await importLegacyConnections({ storage, store, sessionKeys })
            } catch (error) {
                logger.error('[offscreen] legacy walletconnect import failed', {
                    error,
                })
            }
            await importLegacyDappPermissions({
                area: chrome.storage.local,
                store,
            })
        },
    })
    onConnectionsControlMessage(connectionsHost.handleControlMessage)
    // Baselines are taken here, after boot, so nothing restored is announced.
    watchWalletNotices(registry)

    logger.info('[offscreen] connections host started')
}
