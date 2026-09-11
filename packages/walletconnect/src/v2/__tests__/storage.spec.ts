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

import { describe, expect, it, vi } from 'vitest'
import { MemoryKeyValueStorage } from '@perawallet/wallet-extension-platform'
import {
    clearWalletConnectV2Storage,
    createWalletConnectV2Storage,
    WALLET_CONNECT_V2_STORAGE_PREFIX,
} from '../storage'

const memoryKeyValueStorage = (
    seed: Record<string, string> = {},
): MemoryKeyValueStorage => {
    const backing = new MemoryKeyValueStorage()
    for (const [key, value] of Object.entries(seed)) {
        backing.setItem(key, value)
    }
    return backing
}

const snapshot = (backing: MemoryKeyValueStorage): Record<string, string> =>
    Object.fromEntries(
        backing.getAllKeys().map(key => [key, backing.getItem(key) ?? '']),
    )

describe('createWalletConnectV2Storage', () => {
    it('writes every key under the v2 prefix', async () => {
        const backing = memoryKeyValueStorage()
        const storage = createWalletConnectV2Storage(backing)

        await storage.setItem('client_ed25519_seed', 'abc')

        expect(snapshot(backing)).toEqual({
            [`${WALLET_CONNECT_V2_STORAGE_PREFIX}client_ed25519_seed`]:
                JSON.stringify('abc'),
        })
    })

    it('round-trips the value shapes WalletKit stores', async () => {
        const storage = createWalletConnectV2Storage(memoryKeyValueStorage())
        const session = {
            topic: 'a'.repeat(64),
            expiry: 1_800_000_000,
            acknowledged: true,
            namespaces: { algorand: { accounts: ['algorand:x:ADDR'] } },
        }

        await storage.setItem('wc@2:client:0.3//session', [session])
        await storage.setItem('subscription', 12)
        await storage.setItem('label', 'plain string')

        expect(await storage.getItem('wc@2:client:0.3//session')).toEqual([
            session,
        ])
        expect(await storage.getItem('subscription')).toBe(12)
        expect(await storage.getItem('label')).toBe('plain string')
    })

    it('reads a missing key as undefined rather than null', async () => {
        const storage = createWalletConnectV2Storage(memoryKeyValueStorage())

        // WalletKit tests `typeof value === 'undefined'`; a null would read as
        // a stored value.
        expect(await storage.getItem('nothing')).toBeUndefined()
    })

    it('reads a corrupt value as absent', async () => {
        const backing = memoryKeyValueStorage({
            [`${WALLET_CONNECT_V2_STORAGE_PREFIX}broken`]: '{not json',
        })
        const storage = createWalletConnectV2Storage(backing)

        expect(await storage.getItem('broken')).toBeUndefined()
    })

    it('removes only its own prefixed key', async () => {
        const backing = memoryKeyValueStorage({ topic: 'pera-owned' })
        const storage = createWalletConnectV2Storage(backing)
        await storage.setItem('topic', 'wc-owned')

        await storage.removeItem('topic')

        expect(snapshot(backing)).toEqual({ topic: 'pera-owned' })
    })

    it('lists only prefixed keys, with the prefix stripped', async () => {
        const backing = memoryKeyValueStorage({
            'accounts-store': 'pera',
            [`not-${WALLET_CONNECT_V2_STORAGE_PREFIX}mine`]: 'pera',
        })
        const storage = createWalletConnectV2Storage(backing)
        await storage.setItem('keychain', { a: 1 })
        await storage.setItem('messages', { b: 2 })

        expect((await storage.getKeys()).sort()).toEqual([
            'keychain',
            'messages',
        ])
    })

    it('returns entries with the prefix stripped and the values parsed', async () => {
        const backing = memoryKeyValueStorage({ 'accounts-store': 'pera' })
        const storage = createWalletConnectV2Storage(backing)
        await storage.setItem('keychain', { key: 'value' })

        expect(await storage.getEntries()).toEqual([
            ['keychain', { key: 'value' }],
        ])
    })

    it('skips a corrupt entry rather than failing the whole listing', async () => {
        const backing = memoryKeyValueStorage({
            [`${WALLET_CONNECT_V2_STORAGE_PREFIX}broken`]: '{not json',
        })
        const storage = createWalletConnectV2Storage(backing)
        await storage.setItem('good', 1)

        expect(await storage.getEntries()).toEqual([['good', 1]])
    })

    it('cannot read a value Pera wrote under the same bare key', async () => {
        // The whole point of the prefix: both stores share one MMKV instance.
        const backing = memoryKeyValueStorage({ keychain: 'pera-owned' })
        const storage = createWalletConnectV2Storage(backing)

        expect(await storage.getItem('keychain')).toBeUndefined()
        expect(await storage.getKeys()).toEqual([])
    })
})

describe('clearWalletConnectV2Storage', () => {
    const prefixed = (key: string): string =>
        `${WALLET_CONNECT_V2_STORAGE_PREFIX}${key}`

    it('removes every v2 entry and nothing of Pera’s', () => {
        // The keychain (symKeys and the client seed) is one of these rows, and
        // no session disconnect ever removes the seed or an unsettled pairing.
        const backing = memoryKeyValueStorage({
            [prefixed('wc@2:core:0.3//keychain')]: '{"a":"b"}',
            [prefixed('client_ed25519_seed')]: '"seed"',
            keychain: 'pera-owned',
            reactQuery: '{}',
        })

        clearWalletConnectV2Storage(backing)

        expect(snapshot(backing)).toEqual({
            keychain: 'pera-owned',
            reactQuery: '{}',
        })
    })

    it('compacts the store once after removing, so the symKeys leave the file too', () => {
        const trim = vi.fn()
        const backing = Object.assign(
            memoryKeyValueStorage({ [prefixed('client_ed25519_seed')]: '""' }),
            { trim },
        )

        clearWalletConnectV2Storage(backing)

        expect(trim).toHaveBeenCalledTimes(1)
    })

    it('does not compact when there was nothing to remove', () => {
        const trim = vi.fn()
        const backing = Object.assign(memoryKeyValueStorage({ other: '1' }), {
            trim,
        })

        clearWalletConnectV2Storage(backing)

        expect(trim).not.toHaveBeenCalled()
        expect(snapshot(backing)).toEqual({ other: '1' })
    })
})
