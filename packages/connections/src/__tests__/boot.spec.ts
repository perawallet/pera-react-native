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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
import { bootConnections } from '../boot'
import type { ConnectionRegistry } from '../registry'
import { useConnectionsStore } from '../store'

const connection = (id: string): Connection => ({
    id,
    kind: 'walletconnect-v1',
    name: 'Tinyman',
    peer: { name: 'Tinyman' },
    accounts: [],
    status: 'active',
    createdAt: 0,
    lastActiveAt: 0,
})

const makeStore = (items: Connection[] = []) => {
    const listeners = new Set<(c: Connection[]) => void>()
    const api: ConnectionStoreAPI = {
        list: async () => items,
        get: async id => items.find(c => c.id === id),
        upsert: async () => {},
        remove: async () => {},
        clear: async () => {},
        subscribe: listener => {
            listeners.add(listener)
            return () => void listeners.delete(listener)
        },
    }
    return { api, listeners }
}

const makeRegistry = (order: string[]): ConnectionRegistry => ({
    register: vi.fn(),
    initialize: vi.fn(async () => void order.push('initialize')),
    teardown: vi.fn(async () => {}),
    pair: vi.fn(async () => 'pairing-id'),
    abandonPairing: vi.fn(),
    describeUri: vi.fn(() => ({})),
    networksFor: vi.fn(() => []),
    disconnect: vi.fn(async () => {}),
    disconnectAll: vi.fn(async () => {}),
    subscribeToProposals: vi.fn(() => () => {}),
    subscribeToMessages: vi.fn(() => () => {}),
    subscribeToErrors: vi.fn(() => () => {}),
})

const flush = (): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, 0))

describe('bootConnections', () => {
    beforeEach(() => {
        useConnectionsStore.getState().resetState()
    })

    // A handler restored before the import has written its records reports
    // zero sessions, which reconciliation would then delete.
    it('waits for the keystore, imports, initializes, then hydrates the mirror', async () => {
        const order: string[] = []
        const registry = makeRegistry(order)
        const { api } = makeStore([connection('a')])
        let releaseKeystore: () => void = () => {}
        const keystoreReady = new Promise<void>(resolve => {
            releaseKeystore = resolve
        })
        const importLegacy = vi.fn(async () => void order.push('import'))

        const boot = bootConnections({
            registry,
            store: api,
            keystoreReady,
            importLegacy,
        })
        await flush()
        expect(order).toEqual([])

        releaseKeystore()
        const teardown = await boot
        await flush()

        expect(order).toEqual(['import', 'initialize'])
        expect(useConnectionsStore.getState()).toMatchObject({
            connections: [connection('a')],
            isHydrated: true,
        })
        teardown()
    })

    // Crash-resumable: the importer upserts as it goes and retries the
    // remainder next launch, so one bad record must not strand every other
    // handler's restore.
    it('logs an import failure and still initializes', async () => {
        const order: string[] = []
        const registry = makeRegistry(order)
        const error = vi.spyOn(logger, 'error').mockImplementation(() => {})

        await bootConnections({
            registry,
            store: makeStore().api,
            keystoreReady: Promise.resolve(),
            importLegacy: async () => {
                throw new Error('corrupt record')
            },
        })

        expect(order).toEqual(['initialize'])
        expect(error).toHaveBeenCalledWith(
            expect.stringContaining('import failed'),
            expect.objectContaining({ error: new Error('corrupt record') }),
        )
        error.mockRestore()
    })

    it('skips the import step when none is supplied', async () => {
        const order: string[] = []

        await bootConnections({
            registry: makeRegistry(order),
            store: makeStore().api,
            keystoreReady: Promise.resolve(),
        })

        expect(order).toEqual(['initialize'])
    })

    it('stops before initialize when cancelled during the keystore wait', async () => {
        const order: string[] = []
        const registry = makeRegistry(order)
        const { api, listeners } = makeStore()
        let cancelled = false
        let releaseKeystore: () => void = () => {}
        const keystoreReady = new Promise<void>(resolve => {
            releaseKeystore = resolve
        })

        const boot = bootConnections({
            registry,
            store: api,
            keystoreReady,
            isCancelled: () => cancelled,
        })
        cancelled = true
        releaseKeystore()
        const teardown = await boot

        expect(registry.initialize).not.toHaveBeenCalled()
        expect(listeners.size).toBe(0)
        expect(() => teardown()).not.toThrow()
    })

    it('does not hydrate the mirror when cancelled during initialize', async () => {
        const order: string[] = []
        const registry = makeRegistry(order)
        const { api, listeners } = makeStore([connection('a')])
        let cancelled = false
        vi.mocked(registry.initialize).mockImplementation(async () => {
            cancelled = true
        })

        await bootConnections({
            registry,
            store: api,
            keystoreReady: Promise.resolve(),
            isCancelled: () => cancelled,
        })
        await flush()

        expect(listeners.size).toBe(0)
        expect(useConnectionsStore.getState().isHydrated).toBe(false)
    })
})
