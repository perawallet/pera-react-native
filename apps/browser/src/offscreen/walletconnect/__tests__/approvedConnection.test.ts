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

import { describe, it, expect } from 'vitest'
import type { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import { buildApprovedConnection } from '../approvedConnection'
import type { HeadlessWcConnector } from '../bindHeadlessHandlers'

/**
 * Minimal connector fixture — only the fields `buildApprovedConnection`
 * reads (`clientId`, `version`, `bridge`, `connected`, `session`). Includes
 * a private-by-convention `_transport` handle to prove the function never
 * leaks it: it spreads `connector.session`, never `connector` itself.
 */
const makeConnector = (
    overrides: Partial<{
        clientId: string
        version: number
        bridge: string
        connected: boolean
        session: Record<string, unknown>
    }> = {},
): HeadlessWcConnector =>
    ({
        clientId: overrides.clientId ?? 'client-1',
        version: overrides.version ?? 1,
        bridge: overrides.bridge ?? 'https://bridge.example',
        connected: overrides.connected ?? true,
        session: overrides.session ?? { peerId: 'peer-1', chainId: 416_001 },
        _transport: { connected: true },
    }) as unknown as HeadlessWcConnector

describe('buildApprovedConnection', () => {
    it('builds a connection record from the connector, merging permissions and clientId into the session', () => {
        const connector = makeConnector({
            clientId: 'client-1',
            session: { peerId: 'peer-1', chainId: 416_001 },
        })

        const connection = buildApprovedConnection(
            connector,
            ['algo_signTxn'],
            undefined,
        )

        expect(connection.clientId).toBe('client-1')
        expect(connection.version).toBe(1)
        expect(connection.bridge).toBe('https://bridge.example')
        expect(connection.connected).toBe(true)
        expect(connection.session).toEqual({
            peerId: 'peer-1',
            chainId: 416_001,
            permissions: ['algo_signTxn'],
            clientId: 'client-1',
        })
    })

    it('never copies the connector itself into the record — only clean, storable fields', () => {
        const connector = makeConnector()

        const connection = buildApprovedConnection(connector, [], undefined)

        expect(Object.keys(connection).sort()).toEqual([
            'bridge',
            'clientId',
            'connected',
            'createdAt',
            'lastActiveAt',
            'session',
            'version',
        ])
        expect(connection).not.toHaveProperty('_transport')
    })

    it('stamps a fresh createdAt when there is no existing record', () => {
        const connector = makeConnector()

        const connection = buildApprovedConnection(connector, [], undefined)

        expect(connection.createdAt).toBeInstanceOf(Date)
        expect(connection.lastActiveAt).toBeInstanceOf(Date)
    })

    it("preserves the existing record's createdAt across re-approval", () => {
        const connector = makeConnector({ clientId: 'client-1' })
        const originalCreatedAt = new Date('2024-01-01T00:00:00.000Z')
        const existing = {
            clientId: 'client-1',
            createdAt: originalCreatedAt,
        } as unknown as WalletConnectConnection

        const connection = buildApprovedConnection(connector, [], existing)

        expect(connection.createdAt).toBe(originalCreatedAt)
    })
})
