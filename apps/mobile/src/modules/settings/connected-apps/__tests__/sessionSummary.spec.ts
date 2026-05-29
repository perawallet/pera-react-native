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

import { describe, it, expect } from 'vitest'
import type { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import type { LiquidAuthSession } from '@perawallet/wallet-core-liquid-auth'
import { walletConnectToSummary, liquidAuthToSummary } from '../sessionSummary'

describe('sessionSummary adapters', () => {
    it('maps a WalletConnect connection to a summary', () => {
        const createdAt = new Date('2025-01-01T00:00:00.000Z')
        const connection = {
            clientId: 'wc-client-1',
            version: 1,
            session: {
                accounts: ['ADDR_A', 'ADDR_B'],
                peerMeta: {
                    name: 'Tinyman',
                    url: 'https://tinyman.org',
                    icons: ['https://tinyman.org/logo.png'],
                },
            },
            createdAt,
        } as unknown as WalletConnectConnection

        const summary = walletConnectToSummary(connection)

        // createdAt stays a Date (SessionSummary types it as Date); lastActiveAt
        // and connected are absent on this fixture's session.
        expect(summary).toMatchObject({
            type: 'walletconnect',
            id: 'wc-client-1',
            name: 'Tinyman',
            icon: 'https://tinyman.org/logo.png',
            origin: 'https://tinyman.org',
            accounts: ['ADDR_A', 'ADDR_B'],
            createdAt,
        })
    })

    it('maps a Liquid Auth session to a summary', () => {
        const session: LiquidAuthSession = {
            sessionId: 'liquid-session-1',
            requestId: 'req-1',
            host: 'https://debug.liquidauth.com',
            peerMeta: {
                name: 'Liquid dApp',
                origin: 'https://app.example.com',
                icon: 'https://app.example.com/icon.png',
            },
            accounts: ['ADDR_C'],
            genesisHash: 'hash',
            networks: [],
            credentialId: 'cred-1',
            createdAt: 1_700_000_000_000,
            lastActiveAt: 1_700_000_000_000,
            ttl: 1_000,
        }

        const summary = liquidAuthToSummary(session)

        expect(summary).toEqual({
            type: 'liquidauth',
            id: 'liquid-session-1',
            name: 'Liquid dApp',
            icon: 'https://app.example.com/icon.png',
            origin: 'https://app.example.com',
            accounts: ['ADDR_C'],
            createdAt: new Date(1_700_000_000_000),
            lastActiveAt: new Date(1_700_000_000_000),
            connected: true,
        })
    })
})
