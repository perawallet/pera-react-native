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
import { MemoryKeyValueStorage } from '@perawallet/wallet-extension-platform/test-utils'
import { memoryStore } from '@perawallet/wallet-core-connections/testing'
import type { ConnectionHandlerContext } from '@perawallet/wallet-core-connections'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections/dappRequest'
import { Networks } from '@perawallet/wallet-core-shared'
import type { WalletKitFactory } from '../client'
import { createWalletConnectV2Handler } from '../handler'
import {
    createFakeWalletKit,
    ensureChainIds,
    flush,
    makeProposal,
    makeRequest,
    makeSession,
    PAIRING_TOPIC,
    TOPIC,
    type FakeWalletKit,
} from './fakeWalletKit'

// Resolved once, up front, while the real adapter this package's setup file
// registers is still in place — this file's own `beforeEach` clears the
// registry to drive the handler with nothing registered, but the fixtures
// below still need a realistic chain id.
ensureChainIds()

// Same stand-in as the v1/v2 handler specs: the connections barrel reaches
// the provider, whose keystore migration ledger imports react-native-mmkv at
// module scope and has no JS fallback under jsdom.
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

/**
 * The chain adapter this package's other v2 specs rely on
 * (`registerDappRequestAdapter.ts`, a setup file) is reset here, per test, so
 * every case in this file drives the handler with NOTHING registered — the
 * state a real app would never reach outside a bootstrap ordering bug. Vitest
 * isolates each spec file's module graph, so this never reaches other files.
 */
beforeEach(() => {
    dappRequestChainAdapters.reset()
})

const makeContext = (store = memoryStore()) => ({
    store,
    onProposal: vi.fn<ConnectionHandlerContext['onProposal']>(),
    onMessage: vi.fn<ConnectionHandlerContext['onMessage']>(),
    onDisconnected: vi.fn<ConnectionHandlerContext['onDisconnected']>(),
    onRequestExpired: vi.fn<ConnectionHandlerContext['onRequestExpired']>(),
    onError: vi.fn<ConnectionHandlerContext['onError']>(),
})

const makeHandler = (walletKit: FakeWalletKit = createFakeWalletKit()) => {
    const createWalletKit = vi.fn<WalletKitFactory>(async () => walletKit)
    const handler = createWalletConnectV2Handler({
        getNetwork: () => Networks.mainnet,
        projectId: 'a-reown-project-id',
        keyValueStorage: new MemoryKeyValueStorage(),
        createWalletKit,
    })
    return { handler, walletKit }
}

describe('WalletConnect v2 with no chain adapter registered', () => {
    it('refuses a proposal as UNSUPPORTED_CHAINS rather than building a session', async () => {
        const walletKit = createFakeWalletKit()
        const { handler } = makeHandler(walletKit)
        const context = makeContext()
        await handler.initialize(context)

        walletKit.emit('session_proposal', makeProposal())
        await flush()

        expect(context.onProposal).not.toHaveBeenCalled()
        expect(walletKit.rejectSession).toHaveBeenCalledWith(
            expect.objectContaining({
                reason: expect.objectContaining({ code: expect.any(Number) }),
            }),
        )
        expect(context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectInvalidNetworkError',
            }),
            expect.objectContaining({ pairingId: PAIRING_TOPIC }),
        )
    })

    it('refuses a request as UNSUPPORTED_CHAINS rather than forwarding it', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        const { handler } = makeHandler(walletKit)
        const context = makeContext(
            memoryStore([
                {
                    id: TOPIC,
                    kind: 'walletconnect-v2',
                    name: 'Test dApp',
                    peer: { name: 'Test dApp' },
                    accounts: ['A'.repeat(58)],
                    status: 'active',
                    createdAt: 0,
                    lastActiveAt: 0,
                    metadata: {
                        topic: TOPIC,
                        chains: ['algorand:doesnotmatter'],
                        methods: ['algo_signTxn'],
                        expiry: 1_800_000_000,
                    },
                },
            ]),
        )
        await handler.initialize(context)

        walletKit.emit('session_request', makeRequest())
        await flush()

        expect(context.onMessage).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                response: expect.objectContaining({
                    error: expect.objectContaining({
                        code: expect.any(Number),
                    }),
                }),
            }),
        )
    })

    it('throws from restore() rather than reporting no connections, so reconciliation cannot prune every session', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        const { handler } = makeHandler(walletKit)
        await handler.initialize(makeContext())

        await expect(handler.restore()).rejects.toThrow()
    })
})
