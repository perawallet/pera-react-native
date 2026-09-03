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

import { describe, expect, it } from 'vitest'
import { WithConnections } from '../extension'

const makeProvider = () => {
    const map = new Map<string, string>()
    return {
        keyValueStorage: {
            getItem: (k: string) => map.get(k) ?? null,
            setItem: (k: string, v: string) => void map.set(k, v),
            removeItem: (k: string) => void map.delete(k),
        },
    } as Record<string, unknown>
}

describe('WithConnections', () => {
    it('exposes a working store on the provider', async () => {
        const provider = makeProvider()

        const extension = WithConnections(provider, {})

        expect(provider.connections).toBe(extension.connections)
        await extension.connections.store.upsert({
            id: 'a',
            kind: 'walletconnect-v1',
            name: 'Tinyman',
            peer: { name: 'Tinyman' },
            accounts: [],
            status: 'active',
            createdAt: 1,
            lastActiveAt: 1,
        })
        expect(await extension.connections.store.list()).toHaveLength(1)
    })

    it('throws if composed before the platform extension', () => {
        expect(() =>
            WithConnections({} as Record<string, unknown>, {}),
        ).toThrow(/keyValueStorage/)
    })
})
