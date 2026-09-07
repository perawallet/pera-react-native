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
import type { ConnectionsHostDeps } from '../connections/connectionsHost'

// Every dependency below is captured through `vi.hoisted` so the mock
// factories (which vitest hoists above these imports) and the assertions
// in each test share the same function identities.
const {
    startConnectionsHost,
    handleControlMessage,
    onConnectionsControlMessage,
    onLocalStorageKeyChanged,
    sendConnectionApprovalRequest,
    broadcastConnectionsEvent,
    accountsGetState,
    networkGetState,
    connectionStore,
    keyValueStorage,
    registry,
    createConnectionRegistry,
    bootConnections,
    v1Handler,
    createWalletConnectV1Handler,
    sessionKeys,
    createStorageSessionKeyStore,
    importLegacyConnections,
    reconnectAllConnectors,
} = vi.hoisted(() => {
    const handleControlMessage = vi.fn()
    const registry = { register: vi.fn() }
    const v1Handler = { kind: 'walletconnect-v1' }
    const sessionKeys = { commit: vi.fn() }
    return {
        startConnectionsHost: vi.fn((_deps: ConnectionsHostDeps) => ({
            handleControlMessage,
        })),
        handleControlMessage,
        onConnectionsControlMessage: vi.fn(),
        onLocalStorageKeyChanged: vi.fn(),
        sendConnectionApprovalRequest: vi.fn(),
        broadcastConnectionsEvent: vi.fn(),
        accountsGetState: vi.fn(),
        networkGetState: vi.fn(),
        connectionStore: { list: vi.fn() },
        keyValueStorage: { getItem: vi.fn() },
        registry,
        createConnectionRegistry: vi.fn(() => registry),
        bootConnections: vi.fn(async (_options: unknown) => () => {}),
        v1Handler,
        createWalletConnectV1Handler: vi.fn((_options: unknown) => v1Handler),
        sessionKeys,
        createStorageSessionKeyStore: vi.fn(() => sessionKeys),
        importLegacyConnections: vi.fn(async () => ({
            imported: 0,
            skipped: 0,
        })),
        reconnectAllConnectors: vi.fn(),
    }
})

vi.mock('../connections/connectionsHost', () => ({ startConnectionsHost }))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    createWorkerExecutor: vi.fn(() => ({ onDeath: vi.fn() })),
    onLocalStorageKeyChanged,
    startDatabaseHost: vi.fn(() => ({ setReady: vi.fn() })),
    onConnectionsControlMessage,
    sendConnectionApprovalRequest,
    broadcastConnectionsEvent,
}))
vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    getPlatformServices: vi.fn(() => ({ database: {} })),
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        connections: { store: connectionStore },
        keyValueStorage,
    }),
    // Never settles: this context registers no engine key source, so a boot
    // that awaited the keystore would strand the database host with it.
    getKeystore: () => ({ ready: new Promise<void>(() => {}) }),
}))
vi.mock('@perawallet/wallet-core-database', () => ({
    getDatabase: vi.fn(),
    initializeDatabase: vi.fn().mockResolvedValue(undefined),
}))
// `initializeSyncService` is mocked below, so the query client only needs to
// be some object; the real module drags several packages into the graph.
vi.mock('@providers/queryClient', () => ({ queryClient: {} }))
vi.mock('@perawallet/wallet-core-assets', () => ({
    seedAlgoAsset: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@perawallet/wallet-core-background', () => ({
    getSyncService: vi.fn(() => ({ start: vi.fn() })),
    initializeSyncService: vi.fn(),
}))
// The stores are only read through `.getState()` or stashed for
// `.persist.rehydrate()`, so the app-wide selector-hook mocks are replaced
// with the accessor shape these deps rely on.
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
    useCustomNetworkStore: {
        persist: { rehydrate: vi.fn() },
    },
}))
vi.mock('@perawallet/wallet-core-polling', () => ({
    usePollingStore: { persist: { rehydrate: vi.fn() } },
}))
vi.mock('@perawallet/wallet-core-connections', () => ({
    createConnectionRegistry,
    bootConnections,
}))
vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    createWalletConnectV1Handler,
    createStorageSessionKeyStore,
    importLegacyConnections,
    reconnectAllConnectors,
}))

describe('runOffscreenApp connections wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('Worker', vi.fn())
        accountsGetState.mockReturnValue({
            accounts: [{ address: 'ADDR1' }, { address: 'ADDR2' }],
        })
        networkGetState.mockReturnValue({ network: 'mainnet' })
    })

    const boot = async () => {
        const { runOffscreenApp } = await import('../runOffscreenApp')
        await runOffscreenApp()
    }

    it('builds the registry on the provider store and registers the v1 handler with the storage-backed key store', async () => {
        await boot()

        expect(createConnectionRegistry).toHaveBeenCalledWith({
            store: connectionStore,
        })
        expect(createStorageSessionKeyStore).toHaveBeenCalledWith(
            keyValueStorage,
        )
        expect(createWalletConnectV1Handler).toHaveBeenCalledWith({
            getNetwork: expect.any(Function),
            sessionKeys,
        })
        expect(registry.register).toHaveBeenCalledWith(v1Handler)
    })

    it('reads the handler network off the network store', async () => {
        await boot()

        const options = createWalletConnectV1Handler.mock.calls[0]?.[0] as {
            getNetwork: () => string
        }
        expect(options.getNetwork()).toBe('mainnet')
    })

    it('starts the host with the platform-chrome senders and subscribes the control handler', async () => {
        await boot()

        expect(startConnectionsHost).toHaveBeenCalledTimes(1)
        const deps = startConnectionsHost.mock
            .calls[0]?.[0] as ConnectionsHostDeps
        expect(deps.registry).toBe(registry)
        expect(deps.requestApproval).toBe(sendConnectionApprovalRequest)
        expect(deps.broadcastEvent).toBe(broadcastConnectionsEvent)
        expect(deps.reconnectAll).toBe(reconnectAllConnectors)
        expect(onConnectionsControlMessage).toHaveBeenCalledWith(
            handleControlMessage,
        )
    })

    it('wires network and knownAddresses to the real store accessors', async () => {
        await boot()

        const deps = startConnectionsHost.mock
            .calls[0]?.[0] as ConnectionsHostDeps
        expect(deps.network()).toBe('mainnet')
        expect(deps.knownAddresses()).toEqual(['ADDR1', 'ADDR2'])
    })

    // The offscreen document has no vault: boot must not wait on a keystore,
    // and the legacy import must move keys into the same storage-backed store
    // the handler reads from.
    it('boots the registry without a keystore and imports legacy sessions into the storage key store', async () => {
        await boot()

        expect(bootConnections).toHaveBeenCalledWith({
            registry,
            store: connectionStore,
            keystoreReady: expect.any(Promise),
            importLegacy: expect.any(Function),
        })
        const options = bootConnections.mock.calls[0]?.[0] as {
            keystoreReady: Promise<unknown>
            importLegacy: () => Promise<unknown>
        }
        await expect(options.keystoreReady).resolves.toBeUndefined()
        await options.importLegacy()
        expect(importLegacyConnections).toHaveBeenCalledWith({
            storage: keyValueStorage,
            store: connectionStore,
            sessionKeys,
        })
    })

    it('subscribes the control handler before booting, so restore-time traffic is not dropped', async () => {
        await boot()

        const subscribeOrder =
            onConnectionsControlMessage.mock.invocationCallOrder[0]
        const bootOrder = bootConnections.mock.invocationCallOrder[0]
        expect(subscribeOrder).toBeLessThan(bootOrder ?? 0)
    })

    it('no longer rehydrates the legacy wallet-connect store across contexts', async () => {
        await boot()

        const keys = onLocalStorageKeyChanged.mock.calls[0]?.[0] as string[]
        expect(keys).not.toContain('kv:wallet-connect-store')
        expect(keys).toEqual(
            expect.arrayContaining(['kv:accounts-store', 'kv:network-store']),
        )
    })

    it('boots without awaiting keystore.ready', async () => {
        const { runOffscreenApp } = await import('../runOffscreenApp')

        await expect(runOffscreenApp()).resolves.toBeUndefined()
    })
})
