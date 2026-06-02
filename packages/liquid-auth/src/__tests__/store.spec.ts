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
import { useLiquidAuthStore } from '../store/store'
import type { LiquidAuthSession } from '../models'

const makeSession = (
    id: string,
    lastActiveAt: number,
    ttl: number,
): LiquidAuthSession => ({
    sessionId: id,
    requestId: `${id}-req`,
    host: 'https://debug.liquidauth.com',
    peerMeta: { name: 'dApp', origin: 'https://dapp.test' },
    accounts: ['ADDR'],
    genesisHash: 'gh',
    networks: [{ genesisHash: 'gh', genesisId: 'mainnet-v1.0' }],
    credentialId: 'cred',
    createdAt: 0,
    lastActiveAt,
    ttl,
})

describe('useLiquidAuthStore', () => {
    beforeEach(() => {
        useLiquidAuthStore.getState().resetState()
    })

    it('stores and replaces sessions', () => {
        const s = makeSession('a', 1000, 5000)
        useLiquidAuthStore.getState().setSessions([s])
        expect(useLiquidAuthStore.getState().sessions).toEqual([s])
    })

    it('expireSessions drops sessions past their ttl', () => {
        const fresh = makeSession('fresh', 9000, 5000) // expires at 14000
        const stale = makeSession('stale', 1000, 5000) // expired at 6000
        useLiquidAuthStore.getState().setSessions([fresh, stale])

        useLiquidAuthStore.getState().expireSessions(10000)

        const ids = useLiquidAuthStore.getState().sessions.map(x => x.sessionId)
        expect(ids).toEqual(['fresh'])
    })

    it('recordCredential upserts by host+address (replaces the prior id)', () => {
        const base = {
            host: 'https://dapp.example',
            address: 'ADDR_A',
            credentialId: 'cred-1',
            createdAt: 1,
        }
        useLiquidAuthStore.getState().recordCredential(base)
        useLiquidAuthStore
            .getState()
            .recordCredential({ ...base, credentialId: 'cred-2', createdAt: 2 })
        // Different account on the same host is a separate record.
        useLiquidAuthStore.getState().recordCredential({
            ...base,
            address: 'ADDR_B',
            credentialId: 'cred-b',
        })

        const { credentials } = useLiquidAuthStore.getState()
        expect(credentials).toHaveLength(2)
        expect(
            credentials.find(c => c.address === 'ADDR_A')?.credentialId,
        ).toBe('cred-2')
        expect(
            credentials.find(c => c.address === 'ADDR_B')?.credentialId,
        ).toBe('cred-b')
    })

    it('sets and clears the connect request', () => {
        useLiquidAuthStore.getState().setConnectRequest({
            host: 'https://debug.liquidauth.com',
            requestId: 'req-1',
        })
        expect(useLiquidAuthStore.getState().connectRequest).toEqual({
            host: 'https://debug.liquidauth.com',
            requestId: 'req-1',
        })

        useLiquidAuthStore.getState().setConnectRequest(null)
        expect(useLiquidAuthStore.getState().connectRequest).toBeNull()
    })

    it('resetState clears everything', () => {
        useLiquidAuthStore.getState().setSessions([makeSession('a', 1, 1)])
        useLiquidAuthStore.getState().recordCredential({
            host: 'https://dapp.example',
            address: 'ADDR_A',
            credentialId: 'cred-1',
            createdAt: 1,
        })
        useLiquidAuthStore.getState().setConnectionError(new Error('boom'))
        useLiquidAuthStore.getState().setConnectRequest({
            host: 'https://debug.liquidauth.com',
            requestId: 'req-1',
        })
        useLiquidAuthStore.getState().resetState()
        const state = useLiquidAuthStore.getState()
        expect(state.sessions).toEqual([])
        expect(state.credentials).toEqual([])
        expect(state.connectionError).toBeNull()
        expect(state.connectRequest).toBeNull()
    })
})
