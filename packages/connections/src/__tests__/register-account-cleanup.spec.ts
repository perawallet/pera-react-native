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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAccountCleanupRegistry } from '@perawallet/wallet-core-shared'
import type {
    Connection,
    ConnectionStoreAPI,
} from '@perawallet/wallet-extension-connections'
type FakeAccount = { chains: Record<string, { address: string }> }

const accountsState = vi.hoisted(() => ({
    isHydrated: true,
    onHydrated: [] as (() => void)[],
    onSettled: [] as (() => void)[],
}))
const persistedConnections = vi.hoisted(() => ({
    list: vi.fn(async (): Promise<Connection[]> => []),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const { create: createStore } = await import('zustand')
    return {
        useAccountsStore: Object.assign(
            createStore(() => ({ accounts: [] as FakeAccount[] })),
            {
                persist: {
                    hasHydrated: () => accountsState.isHydrated,
                    onFinishHydration: (listener: () => void) => {
                        accountsState.onHydrated.push(listener)
                        return () => {}
                    },
                },
            },
        ),
        whenAccountsHydrationSettled: () =>
            new Promise<void>(resolve => accountsState.onSettled.push(resolve)),
    }
})

vi.mock('@perawallet/wallet-core-signing', () => ({}))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({}))

const { useAccountsStore } = await import('@perawallet/wallet-core-accounts')

// Through the entry only: importing the module directly would register it
// even if the entry stopped loading it.
import {
    disconnectConnectionsForAccount,
    disconnectConnectionsOfRemovedAccounts,
    setActiveConnectionRegistry,
    type ConnectionRegistryClient,
} from '../index'

const connection = (id: string, accounts: string[]): Connection => ({
    id,
    kind: 'walletconnect-v2',
    name: id,
    peer: { name: id },
    accounts,
    status: 'active',
    createdAt: 0,
    lastActiveAt: 0,
})

const activateRegistry = () => {
    const disconnect = vi.fn<ConnectionRegistryClient['disconnect']>(
        async () => {},
    )
    setActiveConnectionRegistry(
        {
            disconnect,
        } as unknown as ConnectionRegistryClient,
        persistedConnections,
    )
    return disconnect
}

describe('disconnectConnectionsForAccount', () => {
    afterEach(() => {
        setActiveConnectionRegistry(null)
        persistedConnections.list.mockReset()
    })

    it('is registered as an account cleanup by the package entry', () => {
        expect(getAccountCleanupRegistry()).toContain(
            disconnectConnectionsForAccount,
        )
    })

    it('disconnects every connection holding the removed account and leaves the rest', async () => {
        const disconnect = activateRegistry()
        persistedConnections.list.mockResolvedValue([
            connection('only', ['AAAA']),
            connection('shared', ['BBBB', 'AAAA']),
            connection('other', ['BBBB']),
        ])

        await disconnectConnectionsForAccount({ accountAddress: 'AAAA' })

        expect(disconnect.mock.calls.map(([id]) => id)).toEqual([
            'only',
            'shared',
        ])
    })

    it('matches an EVM address whatever its checksum casing', async () => {
        const disconnect = activateRegistry()
        persistedConnections.list.mockResolvedValue([
            connection('evm', ['0xAbCdEf0000000000000000000000000000000001']),
        ])

        await disconnectConnectionsForAccount({
            accountAddress: '0xabcdef0000000000000000000000000000000001',
        })

        expect(disconnect).toHaveBeenCalledWith('evm')
    })
})

const setAccounts = (accounts: FakeAccount[]): void => {
    useAccountsStore.setState({ accounts } as never)
}

const revokeThrough = (cutoffs: Record<string, number>): void => {
    useAccountsStore.setState({ connectionRevokedThrough: cutoffs } as never)
}

describe('disconnectConnectionsOfRemovedAccounts', () => {
    afterEach(() => {
        setAccounts([])
        revokeThrough({})
        accountsState.isHydrated = true
        accountsState.onHydrated = []
        accountsState.onSettled = []
    })

    it('disconnects every connection granted before one of its addresses was removed', async () => {
        revokeThrough({
            aaaa: 10,
            '0xabcd00000000000000000000000000000000000b': 10,
        })
        const store = {
            list: async () => [
                connection('gone', ['AAAA']),
                connection('mixed', ['BBBB', 'AAAA']),
                connection('evm', [
                    '0xAbCd00000000000000000000000000000000000B',
                ]),
                connection('kept', ['BBBB']),
            ],
        } as Pick<ConnectionStoreAPI, 'list'>
        const disconnect = vi.fn<ConnectionRegistryClient['disconnect']>(
            async () => {},
        )

        await disconnectConnectionsOfRemovedAccounts({ disconnect }, store)

        expect(disconnect.mock.calls.map(([id]) => id)).toEqual([
            'gone',
            'mixed',
            'evm',
        ])
    })

    it('disconnects nothing for addresses an empty or partial account list lacks', async () => {
        setAccounts([])
        const store = {
            list: async () => [connection('kept', ['AAAA'])],
        } as Pick<ConnectionStoreAPI, 'list'>
        const disconnect = vi.fn<ConnectionRegistryClient['disconnect']>(
            async () => {},
        )

        await disconnectConnectionsOfRemovedAccounts({ disconnect }, store)

        expect(disconnect).not.toHaveBeenCalled()
    })

    it('disconnects pre-removal grants after re-adding an account and keeps new grants', async () => {
        revokeThrough({ aaaa: 10 })
        const store = {
            list: async () => [
                connection('old', ['AAAA']),
                { ...connection('new', ['AAAA']), createdAt: 11 },
            ],
        }
        const disconnect = vi.fn<ConnectionRegistryClient['disconnect']>(
            async () => {},
        )

        await disconnectConnectionsOfRemovedAccounts({ disconnect }, store)

        expect(disconnect.mock.calls).toEqual([['old']])
    })

    it('keeps an older session switched to the account after it came back', async () => {
        revokeThrough({
            aaaa: 10,
            '0xabcd00000000000000000000000000000000000b': 10,
        })
        const store = {
            list: async () => [
                {
                    ...connection('switched', ['AAAA']),
                    accountsGrantedAt: { aaaa: 11 },
                },
                {
                    ...connection('evm-switched', [
                        '0xAbCd00000000000000000000000000000000000B',
                    ]),
                    accountsGrantedAt: {
                        '0xabcd00000000000000000000000000000000000b': 11,
                    },
                },
                {
                    ...connection('switched-away', ['AAAA', 'BBBB']),
                    createdAt: 20,
                    accountsGrantedAt: { aaaa: 5, bbbb: 20 },
                },
            ],
        }
        const disconnect = vi.fn<ConnectionRegistryClient['disconnect']>(
            async () => {},
        )

        await disconnectConnectionsOfRemovedAccounts({ disconnect }, store)

        expect(disconnect.mock.calls).toEqual([['switched-away']])
    })

    it('keeps going when one disconnect fails', async () => {
        revokeThrough({ aaaa: 10, cccc: 10 })
        const store = {
            list: async () => [
                connection('first', ['AAAA']),
                connection('second', ['CCCC']),
            ],
        } as Pick<ConnectionStoreAPI, 'list'>
        const disconnect = vi
            .fn<ConnectionRegistryClient['disconnect']>()
            .mockRejectedValueOnce(new Error('relay down'))
            .mockResolvedValueOnce(undefined)

        await disconnectConnectionsOfRemovedAccounts({ disconnect }, store)

        expect(disconnect).toHaveBeenCalledWith('second')
    })

    it('waits for the accounts store to rehydrate', async () => {
        accountsState.isHydrated = false
        const store = {
            list: async () => [connection('old', ['AAAA'])],
        } as Pick<ConnectionStoreAPI, 'list'>
        const disconnect = vi.fn<ConnectionRegistryClient['disconnect']>(
            async () => {},
        )

        const sweep = disconnectConnectionsOfRemovedAccounts(
            { disconnect },
            store,
        )
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(disconnect).not.toHaveBeenCalled()
        revokeThrough({ aaaa: 10 })
        accountsState.isHydrated = true
        for (const listener of accountsState.onHydrated) listener()
        await sweep

        expect(disconnect).toHaveBeenCalledWith('old')
    })

    it('still finishes when the accounts store fails to rehydrate', async () => {
        accountsState.isHydrated = false
        const store = {
            list: async () => [connection('kept', ['AAAA'])],
        } as Pick<ConnectionStoreAPI, 'list'>
        const disconnect = vi.fn<ConnectionRegistryClient['disconnect']>(
            async () => {},
        )

        const sweep = disconnectConnectionsOfRemovedAccounts(
            { disconnect },
            store,
        )
        for (const settle of accountsState.onSettled) settle()

        await expect(sweep).resolves.toBeUndefined()
        expect(disconnect).not.toHaveBeenCalled()
    })
})
