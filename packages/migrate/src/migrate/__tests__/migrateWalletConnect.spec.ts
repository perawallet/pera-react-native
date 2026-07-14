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
import type { LegacyWalletConnectV1Session } from '@perawallet/wallet-extension-platform'
import type { WalletConnectConnection } from '@perawallet/wallet-core-walletconnect'
import { migrateWalletConnect } from '../migrateWalletConnect'

const { storeState, setWalletConnectConnectionsMock, accountsState } =
    vi.hoisted(() => {
        const setWalletConnectConnectionsMock = vi.fn()
        const storeState = {
            walletConnectConnections: [] as unknown[],
            setWalletConnectConnections: setWalletConnectConnectionsMock,
        }
        const accountsState = {
            accounts: [] as { address: string }[],
        }
        return { storeState, setWalletConnectConnectionsMock, accountsState }
    })

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: {
        getState: () => accountsState,
    },
}))

vi.mock('@perawallet/wallet-core-walletconnect', () => ({
    AlgorandChainId: { mainnet: 416_001 },
    PERA_CLIENT_META: {
        name: 'Pera Wallet',
        description: 'Simply the best Algorand wallet',
        url: 'https://perawallet.app',
        icons: ['https://perawallet.app/favicon.ico'],
    },
    useWalletConnectStore: {
        getState: () => storeState,
    },
}))

const buildSession = (
    overrides: Partial<LegacyWalletConnectV1Session> = {},
): LegacyWalletConnectV1Session => ({
    id: '42',
    peerMeta: {
        name: 'Test dApp',
        url: 'https://example.com',
        icons: ['https://example.com/icon.png'],
        description: 'A dApp',
    },
    isConnected: true,
    isSubscribed: true,
    dateTimestampMs: 1_700_000_000_000,
    fallbackBrowserGroupResponse: null,
    connectedAccounts: ['CONNECTED_ADDR'],
    sessionMetaJson: JSON.stringify({
        bridge: 'https://bridge.walletconnect.org',
        key: 'handshake-key',
        topic: 'topic-1',
        version: '1',
    }),
    clientId: 'client-1',
    peerId: 'peer-1',
    handshakeId: 1_690_000_000_000_001,
    currentKey: 'current-key',
    approvedAccounts: ['APPROVED_ADDR'],
    chainId: 416_002,
    ...overrides,
})

const writtenConnections = (): WalletConnectConnection[] =>
    setWalletConnectConnectionsMock.mock.calls[0][0]

describe('migrateWalletConnect', () => {
    beforeEach(() => {
        setWalletConnectConnectionsMock.mockReset()
        storeState.walletConnectConnections = []
        accountsState.accounts = [
            { address: 'APPROVED_ADDR' },
            { address: 'CONNECTED_ADDR' },
        ]
    })

    it('maps an Android-shaped session field-by-field, preferring currentKey and approvedAccounts', () => {
        const result = migrateWalletConnect([buildSession()])

        expect(result).toEqual({ imported: 1, skipped: 0 })
        expect(setWalletConnectConnectionsMock).toHaveBeenCalledTimes(1)
        const written = writtenConnections()
        expect(written).toHaveLength(1)
        expect(written[0]).toEqual({
            clientId: 'client-1',
            version: 1,
            bridge: 'https://bridge.walletconnect.org',
            connected: false,
            createdAt: new Date(1_700_000_000_000),
            session: {
                connected: true,
                accounts: ['APPROVED_ADDR'],
                chainId: 416_002,
                bridge: 'https://bridge.walletconnect.org',
                key: 'current-key',
                clientId: 'client-1',
                clientMeta: {
                    name: 'Pera Wallet',
                    description: 'Simply the best Algorand wallet',
                    url: 'https://perawallet.app',
                    icons: ['https://perawallet.app/favicon.ico'],
                },
                peerId: 'peer-1',
                peerMeta: {
                    name: 'Test dApp',
                    url: 'https://example.com',
                    icons: ['https://example.com/icon.png'],
                    description: 'A dApp',
                },
                handshakeId: 1_690_000_000_000_001,
                handshakeTopic: 'topic-1',
            },
        })
    })

    it('maps an iOS-shaped session: handshake key fallback, handshakeId 0', () => {
        const result = migrateWalletConnect([
            buildSession({
                currentKey: null,
                handshakeId: null,
            }),
        ])

        expect(result).toEqual({ imported: 1, skipped: 0 })
        const written = writtenConnections()
        expect(written[0].session?.key).toBe('handshake-key')
        expect(written[0].session?.handshakeId).toBe(0)
    })

    it('preserves the legacy chainId', () => {
        migrateWalletConnect([buildSession({ chainId: 416_002 })])

        const written = writtenConnections()
        expect(written[0].session?.chainId).toBe(416_002)
    })

    it('skips a session whose chainId is unknown rather than guessing the network', () => {
        const result = migrateWalletConnect([buildSession({ chainId: null })])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(setWalletConnectConnectionsMock).not.toHaveBeenCalled()
    })

    it('falls back to connectedAccounts when approvedAccounts is null or empty', () => {
        migrateWalletConnect([
            buildSession({ approvedAccounts: null }),
            buildSession({
                approvedAccounts: [],
                clientId: 'client-2',
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k2',
                    topic: 'topic-2',
                    version: '1',
                }),
            }),
        ])

        const written = writtenConnections()
        expect(written[0].session?.accounts).toEqual(['CONNECTED_ADDR'])
        expect(written[1].session?.accounts).toEqual(['CONNECTED_ADDR'])
    })

    it('normalizes epoch-seconds dateTimestampMs to ms', () => {
        migrateWalletConnect([buildSession({ dateTimestampMs: 1_700_000_000 })])

        const written = writtenConnections()
        expect(written[0].createdAt).toEqual(new Date(1_700_000_000_000))
    })

    it.each([
        ['clientId', { clientId: null }],
        ['peerId', { peerId: null }],
        [
            'key',
            {
                currentKey: null,
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    topic: 'topic-1',
                    version: '1',
                }),
            },
        ],
        [
            'bridge',
            {
                sessionMetaJson: JSON.stringify({
                    key: 'k',
                    topic: 'topic-1',
                    version: '1',
                }),
            },
        ],
        [
            'topic',
            {
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k',
                    version: '1',
                }),
            },
        ],
        ['accounts', { approvedAccounts: null, connectedAccounts: [] }],
    ] as const)(
        'skips a session missing %s and writes nothing',
        (_label, overrides) => {
            const result = migrateWalletConnect([
                buildSession(
                    overrides as Partial<LegacyWalletConnectV1Session>,
                ),
            ])

            expect(result).toEqual({ imported: 0, skipped: 1 })
            expect(setWalletConnectConnectionsMock).not.toHaveBeenCalled()
        },
    )

    it('skips sessions already in the store by clientId or handshakeTopic', () => {
        storeState.walletConnectConnections = [
            { clientId: 'client-1', session: { handshakeTopic: 'other' } },
            {
                clientId: 'other-client',
                session: { handshakeTopic: 'topic-2' },
            },
        ]

        const result = migrateWalletConnect([
            buildSession(),
            buildSession({
                clientId: 'client-3',
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k',
                    topic: 'topic-2',
                    version: '1',
                }),
            }),
        ])

        expect(result).toEqual({ imported: 0, skipped: 2 })
        expect(setWalletConnectConnectionsMock).not.toHaveBeenCalled()
    })

    it('does not import the same session twice within one batch', () => {
        const result = migrateWalletConnect([buildSession(), buildSession()])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        expect(setWalletConnectConnectionsMock.mock.calls[0][0]).toHaveLength(1)
    })

    it('malformed sessionMetaJson skips that session without aborting the batch', () => {
        const result = migrateWalletConnect([
            buildSession({ sessionMetaJson: 'not-json{{' }),
            buildSession({
                clientId: 'client-2',
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k2',
                    topic: 'topic-2',
                    version: '1',
                }),
            }),
        ])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        expect(setWalletConnectConnectionsMock.mock.calls[0][0]).toHaveLength(1)
    })

    it('appends imports after pre-existing connections in a single write', () => {
        const existing = {
            clientId: 'pre-existing',
            session: { handshakeTopic: 'pre-topic' },
        }
        storeState.walletConnectConnections = [existing]

        migrateWalletConnect([buildSession()])

        const written = writtenConnections()
        expect(written).toHaveLength(2)
        expect(written[0]).toBe(existing)
        expect(written[1].clientId).toBe('client-1')
    })

    it('skips a session whose account did not migrate', () => {
        accountsState.accounts = []

        const result = migrateWalletConnect([buildSession()])

        expect(result).toEqual({ imported: 0, skipped: 1 })
        expect(setWalletConnectConnectionsMock).not.toHaveBeenCalled()
    })

    it('skips the un-migrated session but imports the migrated one', () => {
        accountsState.accounts = [{ address: 'APPROVED_ADDR' }]

        const result = migrateWalletConnect([
            buildSession({
                clientId: 'client-missing',
                approvedAccounts: ['NOT_MIGRATED_ADDR'],
                sessionMetaJson: JSON.stringify({
                    bridge: 'https://bridge.walletconnect.org',
                    key: 'k',
                    topic: 'topic-missing',
                    version: '1',
                }),
            }),
            buildSession(),
        ])

        expect(result).toEqual({ imported: 1, skipped: 1 })
        const written = writtenConnections()
        expect(written).toHaveLength(1)
        expect(written[0].clientId).toBe('client-1')
    })

    it('returns zeros and writes nothing for an empty input', () => {
        const result = migrateWalletConnect([])

        expect(result).toEqual({ imported: 0, skipped: 0 })
        expect(setWalletConnectConnectionsMock).not.toHaveBeenCalled()
    })
})
