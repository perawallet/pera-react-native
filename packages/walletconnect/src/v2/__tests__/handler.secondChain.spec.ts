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
import {
    ConnectionsError,
    DappRequestCodedError,
    type ConnectionHandlerContext,
    type ConnectionProposal,
    type InboundMessage,
} from '@perawallet/wallet-core-connections'
import {
    DappRequestRejectedError,
    dappRequestChainAdapters,
    type DappRequestChainAdapter,
} from '@perawallet/wallet-core-connections/dappRequest'
import {
    addressCodecs,
    type AddressCodec,
    type ChainId,
    type ChainScope,
    type NetworkId,
} from '@perawallet/wallet-core-chain-contract'
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
const JSON_RPC_SERVER_ERROR = -32_000

const EIP_1193 = {
    'user-rejected': 4001,
    'unauthorized-account': 4100,
    'unsupported-method': 4200,
    'unselected-chain': 4901,
    'unrecognized-chain': 4902,
    'invalid-params': -32_602,
    'limit-exceeded': -32_005,
} as const

const algorandAdapter = dappRequestAdapterFor({
    chainId: 'algorand',
    networkId: 'mainnet',
})
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
        toWireResult: result =>
            result.type === 'send-transaction' ? result.txId : null,
        toWireErrorCode: failure => EIP_1193[failure],
        v2: {
            methods: [
                'eth_sendTransaction',
                'eth_chainId',
                'wallet_switchEthereumChain',
            ],
            signingMethods: ['eth_sendTransaction'],
            sessionEvents: {
                chainChangedData: networkId =>
                    ({ mainnet: '0x1', sepolia: '0xaa36a7' })[networkId] ??
                    null,
            },
            handleRequest: (method, params) => {
                if (method === 'wallet_switchEthereumChain') {
                    const chainId = (params as [{ chainId: string }])[0].chainId
                    return {
                        kind: 'switch-network',
                        caip2ChainId: `eip155:${Number(chainId)}`,
                    }
                }
                if (method === 'eth_sendTransaction') {
                    return {
                        kind: 'operation',
                        type: 'send-transaction',
                        params,
                    }
                }
                if (method === 'eth_unanswerable') {
                    return { kind: 'public-data', answer: () => null }
                }
                if (method === 'eth_later') {
                    return {
                        kind: 'public-data',
                        answer: async () => ({ settled: true }),
                    }
                }
                if (method === 'eth_unknownBundle') {
                    return {
                        kind: 'public-data',
                        answer: async () => {
                            throw new DappRequestCodedError(
                                5730,
                                'Unknown bundle id',
                            )
                        },
                    }
                }
                if (method === 'eth_broken') {
                    return {
                        kind: 'public-data',
                        answer: () => {
                            throw new Error('database at /private/path')
                        },
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
    selectedNetworks.algorand = 'mainnet'
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
    options: Partial<Parameters<typeof createWalletConnectV2Handler>[0]> = {},
) => {
    const handler = createWalletConnectV2Handler({
        ...options,
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
        onRequestWithdrawn:
            vi.fn<
                NonNullable<ConnectionHandlerContext['onRequestWithdrawn']>
            >(),
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
            methods: ['algo_signTxn', 'eth_sendTransaction'],
        })
    })

    it('marks the chains a required namespace names as required', async () => {
        const { proposals, propose } = await open()

        await propose(bothRequired())

        expect(proposals[0].requested.requiredChains).toEqual([
            'algorand',
            'ethereum',
        ])
    })

    it('leaves a chain named only by an optional namespace out of the required ones', async () => {
        const { proposals, propose } = await open()

        await propose(OPTIONAL_ETHEREUM)

        expect(proposals[0].requested.chains).toEqual(['algorand', 'ethereum'])
        expect(proposals[0].requested.requiredChains).toEqual(['algorand'])
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

describe('a settled session', () => {
    it('tells the dApp the selected Ethereum network, not the first one it named', async () => {
        selectedNetworks.ethereum = 'sepolia'
        const { walletKit, proposals, propose } = await open()

        await propose({
            optionalNamespaces: {
                eip155: {
                    chains: [ETH_MAINNET, ETH_SEPOLIA],
                    methods: ['eth_sendTransaction'],
                    events: ['chainChanged'],
                },
            },
        })
        const [proposal] = proposals
        await proposal.approve([ADDRESS, ETH])
        await flush()

        const { topic } = await walletKit.approveSession.mock.results[0].value
        expect(walletKit.emitSessionEvent).toHaveBeenCalledWith({
            topic,
            event: { name: 'chainChanged', data: '0xaa36a7' },
            chainId: ETH_SEPOLIA,
        })
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

    it('refuses a method the chain does not list with the chain’s own unsupported-method code', async () => {
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
                error: expect.objectContaining({
                    code: EIP_1193['unsupported-method'],
                }),
            },
        })
    })

    it('refuses a request on a network of the session that is not the chain’s selected one with the unselected-chain code', async () => {
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
                error: expect.objectContaining({
                    code: EIP_1193['unselected-chain'],
                }),
            },
        })
        expect(context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectInvalidNetworkError',
            }),
            { connectionId: TOPIC },
        )
    })

    it('refuses public data on a network that is not the selected one without telling the user', async () => {
        const { walletKit, context } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({ method: 'eth_chainId', chainId: ETH_SEPOLIA }),
        )
        await flush()

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({
                    code: EIP_1193['unselected-chain'],
                }),
            },
        })
        expect(context.onError).not.toHaveBeenCalled()
    })

    it('answers public data the chain settles later once it settles', async () => {
        const { walletKit, context } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({ method: 'eth_later', chainId: ETH_MAINNET }),
        )
        await flush()

        expect(context.onMessage).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                result: { settled: true },
            },
        })
    })

    it('answers public data the chain refuses in its own code with that code and message', async () => {
        const { walletKit } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({ method: 'eth_unknownBundle', chainId: ETH_MAINNET }),
        )
        await flush()

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: { code: 5730, message: 'Unknown bundle id' },
            },
        })
    })

    it('answers public data that failed in the wallet as an internal error, without its message', async () => {
        const { walletKit } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({ method: 'eth_broken', chainId: ETH_MAINNET }),
        )
        await flush()

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: { code: -32_603, message: 'Internal error' },
            },
        })
    })

    it('answers public data the chain cannot give with the unselected-chain code', async () => {
        const { walletKit } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({
                method: 'eth_unanswerable',
                chainId: ETH_MAINNET,
            }),
        )
        await flush()

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({
                    code: EIP_1193['unselected-chain'],
                }),
            },
        })
    })

    it('keeps the SDK refusals for a chain whose namespace maps no codes', async () => {
        const { walletKit } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({ method: 'algo_unlisted' }),
        )
        await flush()

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({ code: UNSUPPORTED_METHODS }),
            },
        })
    })

    it('keeps the SDK refusal for a chain id no namespace owns', async () => {
        const { walletKit } = await open(seeded())

        walletKit.emit(
            'session_request',
            makeRequest({
                method: 'eth_sendTransaction',
                chainId: 'eip155:137',
            }),
        )
        await flush()

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

describe('a request’s answer', () => {
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
                chains: [MAINNET_CHAIN_ID, ETH_MAINNET],
                methods: ['algo_signTxn', 'eth_sendTransaction'],
                expiry: 1_800_000_000,
            },
        },
    ]

    const delivered = async (request: Parameters<typeof makeRequest>[0]) => {
        const opened = await open(seeded())
        opened.walletKit.emit('session_request', makeRequest(request))
        await flush()
        const [message] = opened.context.onMessage.mock.calls[0] as [
            Extract<InboundMessage, { kind: 'request' }>,
        ]
        return { ...opened, message }
    }

    const ETH_SEND = {
        method: 'eth_sendTransaction',
        params: [{ to: ETH }],
        chainId: ETH_MAINNET,
    }

    it.each([
        ['a user rejection', new DappRequestRejectedError(), 4001],
        [
            'an unauthorized account',
            new ConnectionsError('unauthorized-account', 'not held'),
            4100,
        ],
        [
            'an invalid payload',
            new ConnectionsError('invalid-payload', 'bad params'),
            -32_602,
        ],
        ['a plain failure', new Error('node down'), JSON_RPC_SERVER_ERROR],
        [
            'a refusal in the chain’s own code',
            new DappRequestCodedError(5720, 'Duplicate id'),
            5720,
        ],
    ])('sends eip155 %s as its code', async (_, error, code) => {
        const { walletKit, message } = await delivered(ETH_SEND)

        await message.reject(error)

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: { code, message: error.message },
            },
        })
    })

    it('sends the result the chain’s toWireResult makes', async () => {
        const { walletKit, message } = await delivered(ETH_SEND)

        await message.respond({ type: 'send-transaction', txId: '0xabc' })

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: { id: REQUEST_ID, jsonrpc: '2.0', result: '0xabc' },
        })
    })

    it('still sends an Algorand user rejection as -32000 with its message', async () => {
        const { walletKit, message } = await delivered({})

        await message.reject(new DappRequestRejectedError())

        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: {
                    code: JSON_RPC_SERVER_ERROR,
                    message: 'User rejected',
                },
            },
        })
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

    it('reports only the prompting methods as granted, not the listed ones refused per call', async () => {
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
                    methods: [
                        'eth_sendTransaction',
                        'eth_sign',
                        'eth_chainId',
                        'wallet_switchEthereumChain',
                    ],
                    events: [],
                },
            },
        })
        const { handler } = await open(
            [],
            createFakeWalletKit({ [TOPIC]: session }),
        )

        const [restored] = await handler.restore()

        expect(handler.methodsFor(restored)).toEqual([
            'algo_signTxn',
            'eth_sendTransaction',
        ])
    })
})

const EVENTS = ['accountsChanged', 'chainChanged']

// A live session holding both namespaces, the shape `approveSession` leaves in
// the SDK, with the record the handler stored for it.
const liveSession = (
    topic = TOPIC,
    eip155: { chains?: string[]; events?: string[]; accounts?: string[] } = {},
) =>
    makeSession({
        topic,
        namespaces: {
            algorand: {
                chains: [MAINNET_CHAIN_ID],
                accounts: [`${MAINNET_CHAIN_ID}:${ADDRESS}`],
                methods: ['algo_signTxn'],
                events: EVENTS,
            },
            eip155: {
                chains: eip155.chains ?? [ETH_MAINNET],
                accounts: eip155.accounts ?? [`${ETH_MAINNET}:${ETH}`],
                methods: ['eth_sendTransaction', 'wallet_switchEthereumChain'],
                events: eip155.events ?? EVENTS,
            },
        },
    })

const recordFor = (
    topic = TOPIC,
    overrides: { accounts?: string[]; chains?: string[] } = {},
) => ({
    id: topic,
    kind: 'walletconnect-v2',
    name: 'dApp',
    peer: { name: 'dApp' },
    accounts: overrides.accounts ?? [ADDRESS, ETH],
    status: 'active' as const,
    createdAt: 1,
    lastActiveAt: 1,
    metadata: {
        topic,
        chains: overrides.chains ?? [MAINNET_CHAIN_ID, ETH_MAINNET],
        methods: ['algo_signTxn', 'eth_sendTransaction'],
        expiry: 1_800_000_000,
    },
})

const SECOND_TOPIC = 'b'.repeat(64)

const BOTH_ETHEREUM_NETWORKS = {
    chains: [ETH_MAINNET, ETH_SEPOLIA],
    accounts: [`${ETH_MAINNET}:${ETH}`, `${ETH_SEPOLIA}:${ETH}`],
}

const SWITCH_TO_SEPOLIA = {
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: '0xaa36a7' }],
    chainId: ETH_MAINNET,
}

describe('wallet_switchEthereumChain', () => {
    const live = async (session = liveSession(), record = recordFor(TOPIC)) => {
        const walletKit = createFakeWalletKit({ [TOPIC]: session })
        return await open([record], walletKit)
    }

    const switchRequest = async (
        opened: Awaited<ReturnType<typeof live>>,
        request: Parameters<typeof makeRequest>[0],
    ) => {
        opened.walletKit.emit('session_request', makeRequest(request))
        await flush()
    }

    it('answers a switch to a chain no registered chain serves as unrecognized and tells the user', async () => {
        const opened = await live()

        await switchRequest(opened, {
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x89' }],
            chainId: ETH_MAINNET,
        })

        expect(opened.context.onMessage).not.toHaveBeenCalled()
        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({
                    code: EIP_1193['unrecognized-chain'],
                }),
            },
        })
        expect(opened.context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectUnsupportedNetworkError',
                metadata: expect.objectContaining({
                    params: expect.objectContaining({ chainId: '137' }),
                }),
            }),
            { connectionId: TOPIC },
        )
    })

    it('answers a switch to the selected network the session holds at once, with no prompt', async () => {
        const opened = await live()

        await switchRequest(opened, {
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x1' }],
            chainId: ETH_MAINNET,
        })

        expect(opened.context.onMessage).not.toHaveBeenCalled()
        expect(opened.walletKit.updateSession).not.toHaveBeenCalled()
        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: { id: REQUEST_ID, jsonrpc: '2.0', result: null },
        })
    })

    it('refuses a network that is not the selected one with the unselected-chain code, without asking or telling the user', async () => {
        const opened = await live(liveSession(TOPIC, BOTH_ETHEREUM_NETWORKS))

        await switchRequest(opened, SWITCH_TO_SEPOLIA)

        expect(opened.context.onMessage).not.toHaveBeenCalled()
        expect(opened.walletKit.updateSession).not.toHaveBeenCalled()
        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({
                    code: EIP_1193['unselected-chain'],
                }),
            },
        })
        expect(opened.context.onError).not.toHaveBeenCalled()
    })

    const SWITCH_TO_MAINNET_FROM_SEPOLIA = {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }],
        chainId: ETH_SEPOLIA,
    }

    const lackingMainnet = async () => {
        const opened = await live(
            liveSession(TOPIC, {
                chains: [ETH_SEPOLIA],
                accounts: [`${ETH_SEPOLIA}:${ETH}`],
            }),
            recordFor(TOPIC, { chains: [MAINNET_CHAIN_ID, ETH_SEPOLIA] }),
        )
        await switchRequest(opened, SWITCH_TO_MAINNET_FROM_SEPOLIA)
        const [message] = opened.context.onMessage.mock.calls[0] as [
            Extract<InboundMessage, { kind: 'request' }>,
        ]
        return { ...opened, message }
    }

    it('asks the user before adding the selected network to a session that lacks it', async () => {
        const { walletKit, message } = await lackingMainnet()

        expect(message).toMatchObject({
            kind: 'request',
            chainId: 'ethereum',
            rawOperation: {
                type: 'switch-network',
                params: { networkId: 'mainnet' },
            },
        })
        expect(walletKit.updateSession).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).not.toHaveBeenCalled()
    })

    it('adds the network with only the addresses the session holds, then answers, once the user approves', async () => {
        const { walletKit, store, message } = await lackingMainnet()

        await message.respond({ type: 'switch-network' })

        const { namespaces } = walletKit.updateSession.mock.calls[0][0]
        expect(namespaces.eip155.chains).toEqual([ETH_SEPOLIA, ETH_MAINNET])
        expect(namespaces.eip155.accounts).toEqual([
            `${ETH_SEPOLIA}:${ETH}`,
            `${ETH_MAINNET}:${ETH}`,
        ])
        // The other namespace is carried over untouched.
        expect(namespaces.algorand.accounts).toEqual([
            `${MAINNET_CHAIN_ID}:${ADDRESS}`,
        ])
        const [stored] = await store.list()
        expect(stored.metadata?.chains).toEqual([
            MAINNET_CHAIN_ID,
            ETH_SEPOLIA,
            ETH_MAINNET,
        ])
        expect(
            walletKit.updateSession.mock.invocationCallOrder[0],
        ).toBeLessThan(
            walletKit.respondSessionRequest.mock.invocationCallOrder[0],
        )
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: { id: REQUEST_ID, jsonrpc: '2.0', result: null },
        })
    })

    it('throws rather than answering when the selection moved while the prompt was open', async () => {
        const { walletKit, message } = await lackingMainnet()
        selectedNetworks.ethereum = 'sepolia'

        await expect(
            message.respond({ type: 'switch-network' }),
        ).rejects.toThrow()

        expect(walletKit.updateSession).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).not.toHaveBeenCalled()
        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
    })

    it('throws, and leaves the record alone, when the dApp cannot take the session update', async () => {
        const { walletKit, store, message } = await lackingMainnet()
        walletKit.updateSession.mockRejectedValueOnce(new Error('dApp offline'))

        await expect(
            message.respond({ type: 'switch-network' }),
        ).rejects.toThrow('dApp offline')

        const [stored] = await store.list()
        expect(stored.metadata?.chains).toEqual([MAINNET_CHAIN_ID, ETH_SEPOLIA])
        expect(walletKit.respondSessionRequest).not.toHaveBeenCalled()
    })

    it('sends a rejected switch as the user-rejection code and leaves the session alone', async () => {
        const { walletKit, message } = await lackingMainnet()

        await message.reject(new DappRequestRejectedError())

        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
        expect(walletKit.updateSession).not.toHaveBeenCalled()
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: { code: 4001, message: 'User rejected' },
            },
        })
    })

    it('refuses wallet_addEthereumChain as an unsupported method', async () => {
        const opened = await live()

        await switchRequest(opened, {
            method: 'wallet_addEthereumChain',
            params: [{ chainId: '0x89' }],
            chainId: ETH_MAINNET,
        })

        expect(opened.context.onMessage).not.toHaveBeenCalled()
        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({
                    code: EIP_1193['unsupported-method'],
                }),
            },
        })
    })
})

describe('notify', () => {
    const SEPOLIA_NOTICE = {
        type: 'network-changed',
        scope: { chainId: 'ethereum', networkId: 'sepolia' },
    } as const

    const OTHER_ETH = '0x1111111111111111111111111111111111111111'
    const THIRD_ETH = '0x2222222222222222222222222222222222222222'

    const withSessions = async (
        sessions: Record<string, ReturnType<typeof liveSession>>,
        records: ReturnType<typeof recordFor>[],
    ) => {
        const walletKit = createFakeWalletKit(sessions)
        return await open(records, walletKit)
    }

    it('emits chainChanged with the hex chain id on a session holding the new network', async () => {
        const { handler, walletKit } = await withSessions(
            { [TOPIC]: liveSession(TOPIC, BOTH_ETHEREUM_NETWORKS) },
            [recordFor(TOPIC)],
        )

        await handler.notify?.(TOPIC, SEPOLIA_NOTICE)

        expect(walletKit.updateSession).not.toHaveBeenCalled()
        expect(walletKit.emitSessionEvent).toHaveBeenCalledWith({
            topic: TOPIC,
            event: { name: 'chainChanged', data: '0xaa36a7' },
            chainId: ETH_SEPOLIA,
        })
    })

    it('neither adds the new network nor emits on a session that lacks it', async () => {
        const { handler, walletKit } = await withSessions(
            { [TOPIC]: liveSession() },
            [recordFor(TOPIC)],
        )

        await handler.notify?.(TOPIC, SEPOLIA_NOTICE)

        expect(walletKit.updateSession).not.toHaveBeenCalled()
        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
    })

    it('sends nothing to a session without the chain’s namespace, or for another chain’s notice', async () => {
        const { handler, walletKit } = await withSessions(
            {
                [TOPIC]: makeSession(),
                [SECOND_TOPIC]: liveSession(SECOND_TOPIC),
            },
            [
                recordFor(TOPIC, {
                    accounts: [ADDRESS],
                    chains: [MAINNET_CHAIN_ID],
                }),
                recordFor(SECOND_TOPIC),
            ],
        )

        await handler.notify?.(TOPIC, SEPOLIA_NOTICE)
        await handler.notify?.(SECOND_TOPIC, {
            type: 'network-changed',
            scope: { chainId: 'algorand', networkId: 'testnet' },
        })

        expect(walletKit.updateSession).not.toHaveBeenCalled()
        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
    })

    it('emits nothing when the dApp never asked for chainChanged', async () => {
        const { handler, walletKit } = await withSessions(
            {
                [TOPIC]: liveSession(TOPIC, {
                    ...BOTH_ETHEREUM_NETWORKS,
                    events: ['accountsChanged'],
                }),
            },
            [recordFor(TOPIC)],
        )

        await handler.notify?.(TOPIC, SEPOLIA_NOTICE)

        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
    })

    it('reaches only the eip155 sessions when two of them and an Algorand-only one are open', async () => {
        const SECOND = 'e'.repeat(64)
        const THIRD = 'f'.repeat(64)
        const { handler, walletKit } = await withSessions(
            {
                [TOPIC]: liveSession(TOPIC, BOTH_ETHEREUM_NETWORKS),
                [SECOND]: liveSession(SECOND, BOTH_ETHEREUM_NETWORKS),
                [THIRD]: makeSession({ topic: THIRD }),
            },
            [
                recordFor(TOPIC),
                recordFor(SECOND),
                recordFor(THIRD, {
                    accounts: [ADDRESS],
                    chains: [MAINNET_CHAIN_ID],
                }),
            ],
        )

        for (const id of [TOPIC, SECOND, THIRD]) {
            await handler.notify?.(id, SEPOLIA_NOTICE)
        }

        expect(
            walletKit.emitSessionEvent.mock.calls.map(([call]) => call.topic),
        ).toEqual([TOPIC, SECOND])
    })

    it('emits accountsChanged with the session’s addresses the wallet still holds', async () => {
        const { handler, walletKit } = await withSessions(
            { [TOPIC]: liveSession() },
            [recordFor(TOPIC, { accounts: [ADDRESS, ETH, OTHER_ETH] })],
        )

        await handler.notify?.(TOPIC, {
            type: 'accounts-changed',
            chainId: 'ethereum',
            accounts: [ETH, OTHER_ETH, THIRD_ETH],
            changed: [OTHER_ETH],
        })

        // The wallet also holds THIRD_ETH, which this session never did.
        expect(walletKit.emitSessionEvent).toHaveBeenCalledWith({
            topic: TOPIC,
            event: { name: 'accountsChanged', data: [ETH, OTHER_ETH] },
            chainId: ETH_MAINNET,
        })
    })

    it('emits an empty list once the last account the session held is gone', async () => {
        const { handler, walletKit } = await withSessions(
            { [TOPIC]: liveSession() },
            [recordFor(TOPIC)],
        )

        await handler.notify?.(TOPIC, {
            type: 'accounts-changed',
            chainId: 'ethereum',
            accounts: [],
            changed: [ETH],
        })

        expect(walletKit.emitSessionEvent).toHaveBeenCalledWith({
            topic: TOPIC,
            event: { name: 'accountsChanged', data: [] },
            chainId: ETH_MAINNET,
        })
    })

    it('never tells a session about an account it does not hold', async () => {
        const { handler, walletKit } = await withSessions(
            { [TOPIC]: liveSession() },
            [recordFor(TOPIC)],
        )

        await handler.notify?.(TOPIC, {
            type: 'accounts-changed',
            chainId: 'ethereum',
            accounts: [ETH, OTHER_ETH],
            changed: [OTHER_ETH],
        })

        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
    })

    it('does nothing without a client', async () => {
        const handler = createWalletConnectV2Handler({
            getNetworkId: chainId => selectedNetworks[chainId],
            isDappConnectEnabled: () => true,
            projectId: '',
            keyValueStorage: new MemoryKeyValueStorage(),
        })
        await handler.initialize({
            store: memoryStore([recordFor(TOPIC)]),
            onProposal: vi.fn(),
            onMessage: vi.fn(),
            onDisconnected: vi.fn(),
            onRequestExpired: vi.fn(),
            onRequestWithdrawn: vi.fn(),
            onError: vi.fn(),
        })

        await expect(
            handler.notify?.(TOPIC, SEPOLIA_NOTICE),
        ).resolves.toBeUndefined()
    })
})

describe('matchesChainScope', () => {
    it('matches every chain of a session on its own chain scope', async () => {
        const { handler } = await open()
        const record = recordFor(TOPIC, {
            chains: [MAINNET_CHAIN_ID, ETH_MAINNET, ETH_SEPOLIA],
        }) as never

        expect(
            [
                { chainId: 'algorand', networkId: 'mainnet' },
                { chainId: 'algorand', networkId: 'testnet' },
                { chainId: 'ethereum', networkId: 'mainnet' },
                { chainId: 'ethereum', networkId: 'sepolia' },
            ].map(scope =>
                handler.matchesChainScope(record, scope as ChainScope),
            ),
        ).toEqual([true, false, true, true])
    })
})

describe('changeAccount', () => {
    const NEW_ETH = '0x3333333333333333333333333333333333333333'
    const signable = new Set<string>()

    const withSession = async (
        eip155: Parameters<typeof liveSession>[1] = BOTH_ETHEREUM_NETWORKS,
        record = recordFor(TOPIC, {
            accounts: [ADDRESS, ETH],
            chains: [MAINNET_CHAIN_ID, ETH_MAINNET, ETH_SEPOLIA],
        }),
    ) => {
        const walletKit = createFakeWalletKit({
            [TOPIC]: liveSession(TOPIC, eip155),
        })
        return await open([record], walletKit, {
            canSignWith: (chainId, address) =>
                chainId === 'ethereum' && signable.has(address),
        })
    }

    beforeEach(() => {
        signable.clear()
        signable.add(NEW_ETH)
        signable.add(ETH)
    })

    it('narrows the eip155 namespace to the new address on every chain it holds', async () => {
        const { handler, walletKit, store } = await withSession()

        await handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH)

        const { namespaces } = walletKit.updateSession.mock.calls[0][0]
        expect(namespaces.eip155).toMatchObject({
            chains: [ETH_MAINNET, ETH_SEPOLIA],
            accounts: [
                `${ETH_MAINNET}:${NEW_ETH}`,
                `${ETH_SEPOLIA}:${NEW_ETH}`,
            ],
        })
        expect(namespaces.algorand.accounts).toEqual([
            `${MAINNET_CHAIN_ID}:${ADDRESS}`,
        ])
        const [stored] = await store.list()
        expect(stored.accounts).toEqual([ADDRESS, NEW_ETH])
        expect(walletKit.emitSessionEvent).toHaveBeenCalledWith({
            topic: TOPIC,
            event: { name: 'accountsChanged', data: [NEW_ETH] },
            chainId: ETH_MAINNET,
        })
    })

    // A request read between the switch and the store write would be raised
    // for the account the user just left.
    it('narrows the stored session before telling the relay', async () => {
        const { handler, walletKit, store } = await withSession()
        let storedDuringUpdate: string[] = []
        walletKit.updateSession.mockImplementationOnce(async () => {
            storedDuringUpdate = (await store.list())[0].accounts
            return { acknowledged: async () => {} }
        })

        await handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH)

        expect(storedDuringUpdate).toEqual([ADDRESS, NEW_ETH])
    })

    it('restores the stored session when the relay refuses the update', async () => {
        const { handler, walletKit, store } = await withSession()
        walletKit.updateSession.mockRejectedValueOnce(new Error('relay down'))

        await expect(
            handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH),
        ).rejects.toThrow('relay down')

        expect((await store.list())[0].accounts).toEqual([ADDRESS, ETH])
        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
    })

    // The switch has landed by then; telling the dApp is best effort.
    it('still completes when the dApp cannot be told of the new account', async () => {
        const { handler, walletKit, store } = await withSession()
        walletKit.emitSessionEvent.mockRejectedValueOnce(
            new Error('relay down'),
        )

        await expect(
            handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH),
        ).resolves.toBeUndefined()

        expect((await store.list())[0].accounts).toEqual([ADDRESS, NEW_ETH])
    })

    // The dApp hung up while the relay call was in flight.
    it('does not bring back a session removed while the relay refused the update', async () => {
        const { handler, walletKit, store } = await withSession()
        walletKit.updateSession.mockImplementationOnce(async () => {
            await store.remove(TOPIC)
            throw new Error('No matching key')
        })

        await expect(
            handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH),
        ).rejects.toThrow()

        expect(await store.list()).toEqual([])
    })

    it('restores only the accounts when the relay refuses the update', async () => {
        const { handler, walletKit, store } = await withSession()
        walletKit.updateSession.mockImplementationOnce(async () => {
            const [record] = await store.list()
            await store.upsert({ ...record, lastActiveAt: 42 })
            throw new Error('relay down')
        })

        await expect(
            handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH),
        ).rejects.toThrow()

        const [restored] = await store.list()
        expect(restored.accounts).toEqual([ADDRESS, ETH])
        expect(restored.lastActiveAt).toBe(42)
    })

    it('refuses a session whose EVM chains this build does not serve', async () => {
        const { handler, walletKit } = await withSession({
            chains: ['eip155:137'],
            accounts: [`eip155:137:${ETH}`],
        })

        await expect(
            handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH),
        ).rejects.toThrow()
        expect(walletKit.updateSession).not.toHaveBeenCalled()
    })

    it('updates the session but sends no event when the dApp never asked for accountsChanged', async () => {
        const { handler, walletKit } = await withSession({
            ...BOTH_ETHEREUM_NETWORKS,
            events: ['chainChanged'],
        })

        await handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH)

        expect(walletKit.updateSession).toHaveBeenCalledTimes(1)
        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
    })

    it('does nothing when the address is already the only one', async () => {
        const { handler, walletKit } = await withSession()

        await handler.changeAccount?.(TOPIC, 'ethereum', ETH)

        expect(walletKit.updateSession).not.toHaveBeenCalled()
        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
    })

    it('refuses an address the wallet cannot sign for, changing nothing', async () => {
        signable.delete(NEW_ETH)
        const { handler, walletKit, store } = await withSession()

        await expect(
            handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH),
        ).rejects.toMatchObject({ code: 'unauthorized-account' })

        expect(walletKit.updateSession).not.toHaveBeenCalled()
        const [stored] = await store.list()
        expect(stored.accounts).toEqual([ADDRESS, ETH])
    })

    it('refuses everything without a signer check wired in', async () => {
        const walletKit = createFakeWalletKit({
            [TOPIC]: liveSession(TOPIC, BOTH_ETHEREUM_NETWORKS),
        })
        const { handler } = await open([recordFor(TOPIC)], walletKit)

        await expect(
            handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH),
        ).rejects.toMatchObject({ code: 'unauthorized-account' })
        expect(walletKit.updateSession).not.toHaveBeenCalled()
    })

    // Raised for the old account. Whoever holds it declines it unless the
    // user already approved it, so a send already signing is not answered 4001.
    it('hands the EVM requests pending on the session back to be declined, without answering them itself', async () => {
        const { handler, walletKit, context } = await withSession()
        walletKit.emit(
            'session_request',
            makeRequest({
                method: 'eth_sendTransaction',
                params: [{ to: ETH }],
                chainId: ETH_MAINNET,
            }),
        )
        await flush()
        expect(context.onMessage).toHaveBeenCalled()

        await handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH)
        await flush()

        expect(context.onRequestWithdrawn).toHaveBeenCalledWith(
            TOPIC,
            String(REQUEST_ID),
        )
        expect(walletKit.respondSessionRequest).not.toHaveBeenCalled()
    })

    // The Algorand account did not change, so its request still stands.
    it('leaves a pending Algorand request on a mixed session alone', async () => {
        const { handler, walletKit, context } = await withSession()
        walletKit.emit('session_request', makeRequest({ id: 1 }))
        walletKit.emit(
            'session_request',
            makeRequest({
                id: 2,
                method: 'eth_sendTransaction',
                params: [{ to: ETH }],
                chainId: ETH_MAINNET,
            }),
        )
        await flush()
        expect(context.onMessage).toHaveBeenCalledTimes(2)

        await handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH)
        await flush()

        expect(context.onRequestWithdrawn).toHaveBeenCalledTimes(1)
        expect(context.onRequestWithdrawn).toHaveBeenCalledWith(TOPIC, '2')
    })

    // A chain switch can land while the store is written; writing back the
    // namespaces read before it would undo it.
    it('builds the update from the session as it is when the relay is told', async () => {
        const { handler, walletKit, store } = await withSession()
        const upsert = store.upsert.bind(store)
        vi.spyOn(store, 'upsert').mockImplementationOnce(async record => {
            await upsert(record)
            const live = walletKit.getActiveSessions()[TOPIC]
            live.namespaces = {
                ...live.namespaces,
                eip155: {
                    ...live.namespaces.eip155,
                    events: ['accountsChanged', 'chainChanged', 'added'],
                },
            }
        })

        await handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH)

        const { namespaces } = walletKit.updateSession.mock.calls[0][0]
        expect(namespaces.eip155.events).toContain('added')
    })

    it('puts the accounts back when the session ends while the store is written', async () => {
        const { handler, walletKit, store } = await withSession()
        const upsert = store.upsert.bind(store)
        vi.spyOn(store, 'upsert').mockImplementationOnce(async record => {
            await upsert(record)
            delete walletKit.getActiveSessions()[TOPIC]
        })

        await expect(
            handler.changeAccount?.(TOPIC, 'ethereum', NEW_ETH),
        ).rejects.toThrow()

        expect(walletKit.updateSession).not.toHaveBeenCalled()
        expect((await store.list())[0].accounts).toEqual([ADDRESS, ETH])
    })
})
