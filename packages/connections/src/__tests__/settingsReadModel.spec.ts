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
import type { Connection } from '@perawallet/wallet-extension-connections'
import {
    toConnectionSettingsRow,
    sortConnectionSettingsRows,
} from '../settingsReadModel'

const baseConnection: Connection = {
    id: 'conn-1',
    kind: 'walletconnect-v1',
    name: 'Some Dapp',
    peer: {
        name: 'Some Dapp',
        url: 'https://dapp.example.com',
        icons: ['https://dapp.example.com/icon.png'],
    },
    accounts: ['ADDR_A'],
    status: 'active',
    createdAt: 1_700_000_000_000,
    lastActiveAt: 1_700_000_500_000,
}

describe('toConnectionSettingsRow', () => {
    it('maps a Connection record onto the settings read model', () => {
        expect(
            toConnectionSettingsRow(baseConnection, ['mainnet'], []),
        ).toEqual({
            id: 'conn-1',
            kind: 'walletconnect-v1',
            title: 'Some Dapp',
            subtitle: 'https://dapp.example.com',
            iconUrl: 'https://dapp.example.com/icon.png',
            accounts: ['ADDR_A'],
            isConnected: true,
            createdAt: 1_700_000_000_000,
            lastActiveAt: 1_700_000_500_000,
            peer: baseConnection.peer,
            permissions: [],
            networks: ['mainnet'],
            protocolVersion: 1,
        })
    })

    // The methods come from the handler too: v1 stores them under
    // `permissions` and v2 under `methods`, and the read model reading either
    // key itself is what left the v2 panel empty.
    it('carries the handler-resolved methods, not a key read off the record', () => {
        const row = toConnectionSettingsRow(
            {
                ...baseConnection,
                metadata: { chainId: 416_001, methods: ['algo_signTxn'] },
            },
            [],
            ['algo_signTxn'],
        )

        expect(row.permissions).toEqual(['algo_signTxn'])
    })

    // The networks come from the handler that owns the record, never from a
    // wire value the read model would have to know how to decode.
    it('carries the handler-resolved networks and never a wire chain id', () => {
        const row = toConnectionSettingsRow(
            { ...baseConnection, metadata: { chainId: 4160 } },
            ['mainnet', 'testnet'],
            [],
        )

        expect(row.networks).toEqual(['mainnet', 'testnet'])
        expect(row).not.toHaveProperty('chainId')
    })

    // A kind with no registered handler reports no methods, which the detail
    // screen renders as "unknown" rather than as a broken panel.
    it('reports no methods and no version for an unknown kind', () => {
        const row = toConnectionSettingsRow(
            { ...baseConnection, kind: 'some-other-protocol' },
            [],
            [],
        )

        expect(row.permissions).toEqual([])
        expect(row.protocolVersion).toBeUndefined()
    })

    it('reports an inactive connection as not connected', () => {
        const row = toConnectionSettingsRow(
            { ...baseConnection, status: 'inactive' },
            [],
            [],
        )

        expect(row.isConnected).toBe(false)
    })

    it('falls back to an empty subtitle and no icon when the peer carries neither', () => {
        const row = toConnectionSettingsRow(
            { ...baseConnection, peer: { name: 'Bare Peer' } },
            [],
            [],
        )

        expect(row.subtitle).toBe('')
        expect(row.iconUrl).toBeUndefined()
    })

    // Epoch-ms numbers straight off the record: there is no Date/string
    // rehydration hazard here, so no `toComparableTime` guard is needed.
    it('carries createdAt and lastActiveAt straight through as numbers', () => {
        const row = toConnectionSettingsRow(baseConnection, [], [])

        expect(typeof row.createdAt).toBe('number')
        expect(typeof row.lastActiveAt).toBe('number')
    })
})

describe('sortConnectionSettingsRows', () => {
    it('sorts rows most-recently-active first', () => {
        const older = toConnectionSettingsRow(
            { ...baseConnection, id: 'older', lastActiveAt: 1000 },
            [],
            [],
        )
        const newer = toConnectionSettingsRow(
            { ...baseConnection, id: 'newer', lastActiveAt: 2000 },
            [],
            [],
        )

        expect(
            sortConnectionSettingsRows([older, newer]).map(row => row.id),
        ).toEqual(['newer', 'older'])
    })

    it('does not mutate the input array', () => {
        const older = toConnectionSettingsRow(
            { ...baseConnection, id: 'older', lastActiveAt: 1000 },
            [],
            [],
        )
        const newer = toConnectionSettingsRow(
            { ...baseConnection, id: 'newer', lastActiveAt: 2000 },
            [],
            [],
        )
        const input = [older, newer]

        sortConnectionSettingsRows(input)

        expect(input).toEqual([older, newer])
    })
})
