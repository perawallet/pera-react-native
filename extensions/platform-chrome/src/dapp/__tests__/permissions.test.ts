/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
    DappPermissionStore,
    DAPP_PERMISSIONS_STORAGE_KEY,
} from '../permissions'

// Minimal in-memory LocalStorageArea fake (validates the key it's asked for).
const makeArea = () => {
    const backing: Record<string, unknown> = {}
    return {
        backing,
        get: async (key: string) => {
            expect(key).toBe(DAPP_PERMISSIONS_STORAGE_KEY)
            return key in backing ? { [key]: backing[key] } : {}
        },
        set: async (items: Record<string, unknown>) => {
            Object.assign(backing, items)
        },
    }
}

const A = 'ADDR_A'.padEnd(58, 'A')
const B = 'ADDR_B'.padEnd(58, 'B')

describe('DappPermissionStore', () => {
    let area: ReturnType<typeof makeArea>
    let store: DappPermissionStore
    let clock: number

    beforeEach(() => {
        area = makeArea()
        clock = 1000
        store = new DappPermissionStore(area, () => clock++)
    })

    it('starts empty', async () => {
        expect(await store.list()).toEqual([])
        expect(await store.get('https://x.com')).toBeNull()
        expect(await store.isConnected('https://x.com')).toBe(false)
        expect(await store.approvedAddresses('https://x.com')).toEqual([])
    })

    it('grants and reads back a permission keyed by origin', async () => {
        const granted = await store.grant('https://x.com', [A, B], {
            name: 'X',
        })
        expect(granted.origin).toBe('https://x.com')
        expect(granted.addresses).toEqual([A, B])
        expect(granted.name).toBe('X')
        expect(await store.isConnected('https://x.com')).toBe(true)
        expect(await store.approvedAddresses('https://x.com')).toEqual([A, B])
    })

    it('grant on an existing origin replaces the address set', async () => {
        await store.grant('https://x.com', [A, B])
        await store.grant('https://x.com', [A])
        expect(await store.approvedAddresses('https://x.com')).toEqual([A])
    })

    it('lists newest-first', async () => {
        await store.grant('https://old.com', [A])
        await store.grant('https://new.com', [A])
        expect((await store.list()).map(p => p.origin)).toEqual([
            'https://new.com',
            'https://old.com',
        ])
    })

    it('revoke removes only the target origin', async () => {
        await store.grant('https://x.com', [A])
        await store.grant('https://y.com', [A])
        await store.revoke('https://x.com')
        expect(await store.isConnected('https://x.com')).toBe(false)
        expect(await store.isConnected('https://y.com')).toBe(true)
    })

    it('pruneAddresses drops deleted wallet addresses and revokes emptied origins', async () => {
        await store.grant('https://x.com', [A, B])
        await store.grant('https://y.com', [B])
        await store.pruneAddresses(new Set([A]))
        expect(await store.approvedAddresses('https://x.com')).toEqual([A])
        expect(await store.isConnected('https://y.com')).toBe(false)
    })
})
