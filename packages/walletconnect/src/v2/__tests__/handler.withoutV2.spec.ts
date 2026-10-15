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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryKeyValueStorage } from '@perawallet/wallet-extension-platform/test-utils'
import { memoryStore } from '@perawallet/wallet-core-connections/testing'
import type { ConnectionHandlerContext } from '@perawallet/wallet-core-connections'
import { dappRequestChainAdapters } from '@perawallet/wallet-core-connections/dappRequest'
import { Networks } from '@perawallet/wallet-core-shared'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { dappRequestAdapterFor } from '../../shared/chainSupport'
import type { WalletKitFactory } from '../client'
import { createWalletConnectV2Handler } from '../handler'
import {
    ADDRESS,
    createFakeWalletKit,
    flush,
    MAINNET_CHAIN_ID,
    makeProposal,
    makeRequest,
    makeSession,
    TOPIC,
} from './fakeWalletKit'

// Same stand-in as the other v2 specs: the connections barrel reaches the
// provider, which imports react-native-mmkv at module scope.
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

const registeredAdapter = dappRequestAdapterFor(
    scopeForLegacyNetwork(Networks.mainnet),
)
if (!registeredAdapter) {
    throw new Error('the package setup file registers the Algorand adapter')
}
const { v2: _servedV2, ...walletConnectWithoutV2 } =
    registeredAdapter.walletConnect

// The active network's chain is registered but serves no v2: the handler must
// refuse exactly as it does when no adapter is registered at all.
beforeEach(() => {
    dappRequestChainAdapters.reset()
    dappRequestChainAdapters.register({
        ...registeredAdapter,
        walletConnect: walletConnectWithoutV2,
    })
})

afterEach(() => {
    dappRequestChainAdapters.reset()
    dappRequestChainAdapters.register(registeredAdapter)
})

const makeContext = (store = memoryStore()) => ({
    store,
    onProposal: vi.fn<ConnectionHandlerContext['onProposal']>(),
    onMessage: vi.fn<ConnectionHandlerContext['onMessage']>(),
    onDisconnected: vi.fn<ConnectionHandlerContext['onDisconnected']>(),
    onRequestExpired: vi.fn<ConnectionHandlerContext['onRequestExpired']>(),
    onError: vi.fn<ConnectionHandlerContext['onError']>(),
})

const makeHandler = (walletKit = createFakeWalletKit()) =>
    createWalletConnectV2Handler({
        getNetworkId: () => Networks.mainnet,
        isDappConnectEnabled: () => true,
        projectId: 'a-reown-project-id',
        keyValueStorage: new MemoryKeyValueStorage(),
        createWalletKit: vi.fn<WalletKitFactory>(async () => walletKit),
    })

describe('WalletConnect v2 when the active chain serves no v2', () => {
    it('refuses a proposal as UNSUPPORTED_CHAINS', async () => {
        const walletKit = createFakeWalletKit()
        const context = makeContext()
        await makeHandler(walletKit).initialize(context)

        walletKit.emit('session_proposal', makeProposal())
        await flush()

        expect(context.onProposal).not.toHaveBeenCalled()
        expect(walletKit.rejectSession).toHaveBeenCalledWith(
            expect.objectContaining({
                reason: expect.objectContaining({ code: 5100 }),
            }),
        )
        expect(context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectInvalidNetworkError',
            }),
            expect.anything(),
        )
    })

    it('refuses a request as UNSUPPORTED_CHAINS', async () => {
        const walletKit = createFakeWalletKit({ [TOPIC]: makeSession() })
        const context = makeContext(
            memoryStore([
                {
                    id: TOPIC,
                    kind: 'walletconnect-v2',
                    name: 'Test dApp',
                    peer: { name: 'Test dApp' },
                    accounts: [ADDRESS],
                    status: 'active',
                    createdAt: 0,
                    lastActiveAt: 0,
                    metadata: {
                        topic: TOPIC,
                        chains: [MAINNET_CHAIN_ID],
                        methods: ['algo_signTxn'],
                        expiry: 1_800_000_000,
                    },
                },
            ]),
        )
        await makeHandler(walletKit).initialize(context)

        walletKit.emit('session_request', makeRequest())
        await flush()

        expect(context.onMessage).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                response: expect.objectContaining({
                    error: expect.objectContaining({ code: 5100 }),
                }),
            }),
        )
    })
})
