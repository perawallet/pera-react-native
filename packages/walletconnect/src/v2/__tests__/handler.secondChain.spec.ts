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
import type {
    ConnectionHandlerContext,
    ConnectionProposal,
} from '@perawallet/wallet-core-connections'
import {
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '@perawallet/wallet-core-connections/dappRequest'
import {
    addressCodecs,
    type AddressCodec,
    type ChainId,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import { Networks } from '@perawallet/wallet-core-shared'
import { dappRequestAdapterFor } from '../../shared/chainSupport'
import type { WalletKitFactory } from '../client'
import { createWalletConnectV2Handler } from '../handler'
import {
    ADDRESS,
    createFakeWalletKit,
    ensureChainIds,
    flush,
    MAINNET_CHAIN_ID,
    makeProposal,
    makeRequest,
    makeSession,
    PROPOSAL_ID,
    REQUEST_ID,
    TOPIC,
} from './fakeWalletKit'

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

const ETH = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const ETH_MAINNET = 'eip155:1'
const ETH_SEPOLIA = 'eip155:11155111'

const UNSUPPORTED_CHAINS = 5100
const UNSUPPORTED_METHODS = 5101
const UNSUPPORTED_NAMESPACE_KEY = 5104

const algorandAdapter = dappRequestAdapterFor(Networks.mainnet)
if (!algorandAdapter) {
    throw new Error('the package setup file registers the Algorand adapter')
}
const algorandCodec = addressCodecs.get('algorand')

const ethereumAdapter: DappRequestChainAdapter = {
    chainId: 'ethereum',
    relayableErrorNames: [],
    accountTypeOf: () => 'Fixture',
    parseSigningParams: () => ({
        ok: false,
        reason: 'missing',
        message: 'Missing payload',
    }),
    resolveReportedNetwork: () => undefined,
    emptySignaturesFor: () => ({}),
    walletConnect: {
        namespace: 'eip155',
        caip2ChainIdFor: networkId =>
            ({ mainnet: ETH_MAINNET, sepolia: ETH_SEPOLIA })[networkId] ?? null,
        networkForCaip2ChainId: caip2 =>
            ({ [ETH_MAINNET]: 'mainnet', [ETH_SEPOLIA]: 'sepolia' })[caip2] ??
            null,
        toWireResult: () => null,
        v2: {
            methods: ['eth_sendTransaction', 'eth_chainId'],
            signingMethods: ['eth_sendTransaction'],
            handleRequest: (method, params) => {
                if (method === 'eth_sendTransaction') {
                    return {
                        kind: 'operation',
                        type: 'send-transaction',
                        params,
                    }
                }
                if (method === 'eth_chainId') {
                    return {
                        kind: 'public-data',
                        answer: (_addresses, networkId) =>
                            networkId === 'mainnet' ? '0x1' : '0xaa36a7',
                    }
                }
                return { kind: 'unsupported' }
            },
        },
    },
    validateTransactionPayload: () => ({ ok: false, message: 'Unused' }),
    useEnqueueTransactionSigning: () => async () => null,
}

const ethereumCodec: AddressCodec = {
    ...algorandCodec,
    chainId: 'ethereum',
    isValid: address => /^0x[0-9a-fA-F]{40}$/.test(address),
    normalize: address => address,
}

// A function: `MAINNET_CHAIN_ID` resolves lazily, once a test body runs.
const bothRequired = () => ({
    requiredNamespaces: {
        algorand: {
            chains: [MAINNET_CHAIN_ID],
            methods: ['algo_signTxn'],
            events: [],
        },
        eip155: {
            chains: [ETH_MAINNET],
            methods: ['eth_sendTransaction'],
            events: [],
        },
    },
})

const OPTIONAL_ETHEREUM = {
    optionalNamespaces: {
        eip155: {
            chains: [ETH_MAINNET],
            methods: ['eth_sendTransaction'],
            events: [],
        },
    },
}

const connectable = new Set<ChainId>()
const selectedNetworks: Record<string, NetworkId> = {}

beforeEach(() => {
    ensureChainIds()
    dappRequestChainAdapters.register(ethereumAdapter)
    addressCodecs.register(ethereumCodec)
    connectable.clear()
    connectable.add('algorand')
    connectable.add('ethereum')
    selectedNetworks.algorand = Networks.mainnet
    selectedNetworks.ethereum = 'mainnet'
})

afterEach(() => {
    dappRequestChainAdapters.reset()
    dappRequestChainAdapters.register(algorandAdapter)
    addressCodecs.reset()
    addressCodecs.register(algorandCodec)
})

const open = async (
    seed: Parameters<typeof memoryStore>[0] = [],
    walletKit = createFakeWalletKit(),
) => {
    const handler = createWalletConnectV2Handler({
        getNetworkId: chainId => selectedNetworks[chainId],
        isDappConnectEnabled: chainId => connectable.has(chainId),
        projectId: 'a-reown-project-id',
        keyValueStorage: new MemoryKeyValueStorage(),
        createWalletKit: vi.fn<WalletKitFactory>(async () => walletKit),
    })
    const store = memoryStore(seed)
    const proposals: ConnectionProposal[] = []
    const context = {
        store,
        onProposal: (received: ConnectionProposal) =>
            void proposals.push(received),
        onMessage: vi.fn<ConnectionHandlerContext['onMessage']>(),
        onDisconnected: vi.fn<ConnectionHandlerContext['onDisconnected']>(),
        onRequestExpired: vi.fn<ConnectionHandlerContext['onRequestExpired']>(),
        onError: vi.fn<ConnectionHandlerContext['onError']>(),
    }
    await handler.initialize(context)

    const propose = async (
        overrides: Parameters<typeof makeProposal>[0],
    ): Promise<void> => {
        walletKit.emit('session_proposal', makeProposal(overrides))
        await flush()
    }
    return { handler, walletKit, store, context, proposals, propose }
}

const approvedNamespaces = (
    walletKit: ReturnType<typeof createFakeWalletKit>,
): Record<string, { accounts: string[] }> =>
    walletKit.approveSession.mock.calls[0][0].namespaces as Record<
        string,
        { accounts: string[] }
    >

describe('a proposal spanning algorand and eip155', () => {
    it('surfaces both chains and approves each address under its own namespace only', async () => {
        const { walletKit, store, proposals, propose } = await open()

        await propose(bothRequired())
        const [proposal] = proposals
        await proposal.approve([ADDRESS, ETH])

        expect(proposal.requested.chains).toEqual(['algorand', 'ethereum'])
        const namespaces = approvedNamespaces(walletKit)
        expect(namespaces.algorand.accounts).toEqual([
            `${MAINNET_CHAIN_ID}:${ADDRESS}`,
        ])
        expect(namespaces.eip155.accounts).toEqual([`${ETH_MAINNET}:${ETH}`])
        const [record] = await store.list()
        expect(record.accounts).toEqual([ADDRESS, ETH])
        expect(record.metadata).toMatchObject({
            chains: [MAINNET_CHAIN_ID, ETH_MAINNET],
            methods: expect.arrayContaining([
                'algo_signTxn',
                'eth_sendTransaction',
            ]),
        })
    })

    it('lists only the chains that offer a signing method as permissions', async () => {
        const { proposals, propose } = await open()

        await propose(bothRequired())

        expect(proposals[0].requested.methods).toEqual([
            'algo_signTxn',
            'eth_sendTransaction',
        ])
    })
})

describe('with the second chain not connectable', () => {
    beforeEach(() => {
        connectable.delete('ethereum')
    })

    it('rejects a proposal requiring eip155 and never surfaces it', async () => {
        const { walletKit, proposals, propose } = await open()

        await propose(bothRequired())

        expect(proposals).toEqual([])
        expect(walletKit.rejectSession).toHaveBeenCalledWith({
            id: PROPOSAL_ID,
            reason: expect.objectContaining({
                code: UNSUPPORTED_NAMESPACE_KEY,
            }),
        })
    })

    it('drops an optional eip155 namespace and settles algorand only', async () => {
        const { walletKit, proposals, propose } = await open()

        await propose(OPTIONAL_ETHEREUM)
        const [proposal] = proposals
        await proposal.approve([ADDRESS, ETH])

        expect(proposal.requested.chains).toEqual(['algorand'])
        expect(Object.keys(approvedNamespaces(walletKit))).toEqual(['algorand'])
    })
})

describe('a capability that flips between proposal and approve', () => {
    it('settles algorand only', async () => {
        const { walletKit, proposals, propose } = await open()
        await propose(OPTIONAL_ETHEREUM)
        const [proposal] = proposals
        expect(proposal.requested.chains).toEqual(['algorand', 'ethereum'])

        connectable.delete('ethereum')
        await proposal.approve([ADDRESS, ETH])

        expect(Object.keys(approvedNamespaces(walletKit))).toEqual(['algorand'])
    })
})

describe('a required chain with no approved address', () => {
    it('fails the approval with a terminal typed error and leaves the proposal answerable', async () => {
        const { walletKit, proposals, propose } = await open()
        await propose(bothRequired())
        const [proposal] = proposals

        await expect(proposal.approve([ADDRESS])).rejects.toMatchObject({
            metadata: { retryable: false },
        })
        expect(walletKit.approveSession).not.toHaveBeenCalled()

        await expect(proposal.approve([ADDRESS, ETH])).resolves.toMatchObject({
            accounts: [ADDRESS, ETH],
        })
    })
})

describe('a required chain that stops being connectable before approve', () => {
    it('fails the approval with a terminal typed error', async () => {
        const { walletKit, proposals, propose } = await open()
        await propose(bothRequired())
        const [proposal] = proposals

        connectable.delete('ethereum')

        await expect(proposal.approve([ADDRESS, ETH])).rejects.toMatchObject({
            metadata: { retryable: false },
        })
        expect(walletKit.approveSession).not.toHaveBeenCalled()
    })
})

describe('requests', () => {
    const seeded = () => [
        {
            id: TOPIC,
            kind: 'walletconnect-v2',
            name: 'dApp',
            peer: { name: 'dApp' },
            accounts: [ADDRESS, ETH],
            status: 'active' as const,
            createdAt: 1,
            lastActiveAt: 1,
            metadata: {
                topic: TOPIC,
                chains: [MAINNET_CHAIN_ID, ETH_MAINNET, ETH_SEPOLIA],
                methods: ['algo_signTxn', 'eth_sendTransaction'],
                expiry: 1_800_000_000,
            },
        },
    ]

    it('routes an eip155 request to its chain with only that chain’s addresses', async () => {
        const { walletKit, context } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({
                method: 'eth_sendTransaction',
                params: [{ to: ETH }],
                chainId: ETH_MAINNET,
            }),
        )
        await flush()

        expect(context.onMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'request',
                chainId: 'ethereum',
                authorizedAccounts: [ETH],
                correlationId: String(REQUEST_ID),
                rawOperation: {
                    type: 'send-transaction',
                    params: [{ to: ETH }],
                },
            }),
        )
    })

    it('still routes an algorand request with only algorand addresses', async () => {
        const { walletKit, context } = await open(seeded())

        walletKit.emit('session_request', makeRequest())
        await flush()

        expect(context.onMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                chainId: 'algorand',
                authorizedAccounts: [ADDRESS],
            }),
        )
    })

    it('answers public data without asking the registry', async () => {
        const { walletKit, context } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({ method: 'eth_chainId', chainId: ETH_MAINNET }),
        )
        await flush()

        expect(context.onMessage).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: { id: REQUEST_ID, jsonrpc: '2.0', result: '0x1' },
        })
    })

    it('refuses a method the chain does not list', async () => {
        const { walletKit, context } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({
                method: 'eth_signTransaction',
                chainId: ETH_MAINNET,
            }),
        )
        await flush()

        expect(context.onMessage).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({ code: UNSUPPORTED_METHODS }),
            },
        })
    })

    it('refuses a request on a network of the session that is not the chain’s selected one', async () => {
        const { walletKit, context } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({
                method: 'eth_sendTransaction',
                chainId: ETH_SEPOLIA,
            }),
        )
        await flush()

        expect(context.onMessage).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({ code: UNSUPPORTED_CHAINS }),
            },
        })
    })

    it('serves an existing session after the chain stops being connectable', async () => {
        const { walletKit, context } = await open(seeded())
        connectable.delete('ethereum')

        walletKit.emit(
            'session_request',
            makeRequest({
                method: 'eth_sendTransaction',
                params: [{ to: ETH }],
                chainId: ETH_MAINNET,
            }),
        )
        await flush()

        expect(context.onMessage).toHaveBeenCalledTimes(1)
    })
})

describe('restore', () => {
    it('restores a session holding both namespaces as one record', async () => {
        const session = makeSession({
            namespaces: {
                algorand: {
                    chains: [MAINNET_CHAIN_ID],
                    accounts: [`${MAINNET_CHAIN_ID}:${ADDRESS}`],
                    methods: ['algo_signTxn'],
                    events: [],
                },
                eip155: {
                    chains: [ETH_MAINNET],
                    accounts: [`${ETH_MAINNET}:${ETH}`],
                    methods: ['eth_sendTransaction'],
                    events: [],
                },
            },
        })
        const { handler } = await open(
            [],
            createFakeWalletKit({ [TOPIC]: session }),
        )

        const restored = await handler.restore()

        expect(restored).toHaveLength(1)
        expect(restored[0]).toMatchObject({
            id: TOPIC,
            accounts: [ADDRESS, ETH],
            metadata: {
                chains: [MAINNET_CHAIN_ID, ETH_MAINNET],
                methods: ['algo_signTxn', 'eth_sendTransaction'],
            },
        })
    })
})
