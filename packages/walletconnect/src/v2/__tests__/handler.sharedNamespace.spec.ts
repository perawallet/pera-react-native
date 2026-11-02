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
    InboundMessage,
    WalletNotice,
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
import { dappRequestAdapterFor } from '../../shared/chainSupport'
import type { WalletKitFactory } from '../client'
import { createWalletConnectV2Handler } from '../handler'
import {
    createFakeWalletKit,
    ensureChainIds,
    flush,
    makeProposal,
    makeRequest,
    makeSession,
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

const ETHEREUM_MAINNET = 'eip155:1'
const ETHEREUM_SEPOLIA = 'eip155:11155111'
const BASE_MAINNET = 'eip155:8453'
const BASE_SEPOLIA = 'eip155:84532'

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

type EvmFixture = {
    chainId: ChainId
    mainnet: string
    sepolia: string
}

// Two chains behind one `eip155` namespace, each knowing only its own ids.
const evmAdapter = ({
    chainId,
    mainnet,
    sepolia,
}: EvmFixture): DappRequestChainAdapter => {
    const networks: Record<string, NetworkId> = {
        [mainnet]: 'mainnet',
        [sepolia]: 'sepolia',
    }
    return {
        chainId,
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
                networkId === 'mainnet'
                    ? mainnet
                    : networkId === 'sepolia'
                      ? sepolia
                      : null,
            networkForCaip2ChainId: caip2 => networks[caip2] ?? null,
            toWireResult: result =>
                result.type === 'send-transaction' ? result.txId : null,
            toWireErrorCode: failure => EIP_1193[failure],
            v2: {
                methods: [
                    'eth_sendTransaction',
                    'eth_sign',
                    'wallet_getPermissions',
                    'wallet_switchEthereumChain',
                ],
                signingMethods: ['eth_sendTransaction'],
                sessionEvents: { chainChangedData: () => '0x1' },
                handleRequest: (method, params) => {
                    if (method === 'wallet_switchEthereumChain') {
                        const [{ chainId: hex }] = params as [
                            { chainId: string },
                        ]
                        return {
                            kind: 'switch-network',
                            caip2ChainId: `eip155:${Number(hex)}`,
                        }
                    }
                    if (method === 'eth_sendTransaction') {
                        return {
                            kind: 'operation',
                            type: 'send-transaction',
                            params,
                        }
                    }
                    if (method === 'eth_sign') {
                        return {
                            kind: 'refused',
                            error: { code: 4200, message: 'Not served' },
                            failure: 'unsupported-method',
                        }
                    }
                    if (method === 'wallet_getPermissions') {
                        return {
                            kind: 'refused',
                            error: { code: 4200, message: 'Not served' },
                        }
                    }
                    return { kind: 'unsupported' }
                },
            },
        },
        validateTransactionPayload: () => ({ ok: false, message: 'Unused' }),
        useEnqueueTransactionSigning: () => async () => null,
    }
}

const ethereumAdapter = evmAdapter({
    chainId: 'ethereum',
    mainnet: ETHEREUM_MAINNET,
    sepolia: ETHEREUM_SEPOLIA,
})
const baseAdapter = evmAdapter({
    chainId: 'base',
    mainnet: BASE_MAINNET,
    sepolia: BASE_SEPOLIA,
})

const evmCodec = (chainId: ChainId): AddressCodec => ({
    ...algorandCodec,
    chainId,
    isValid: address => /^0x[0-9a-fA-F]{40}$/.test(address),
    normalize: address => address,
})

const connectable = new Set<ChainId>()
const selectedNetworks: Record<string, NetworkId> = {}

beforeEach(() => {
    ensureChainIds()
    dappRequestChainAdapters.register(ethereumAdapter)
    dappRequestChainAdapters.register(baseAdapter)
    addressCodecs.register(evmCodec('ethereum'))
    addressCodecs.register(evmCodec('base'))
    connectable.clear()
    connectable.add('algorand')
    connectable.add('ethereum')
    connectable.add('base')
    selectedNetworks.algorand = 'mainnet'
    selectedNetworks.ethereum = 'mainnet'
    selectedNetworks.base = 'mainnet'
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
    return { handler, walletKit, store, context, proposals }
}

const eip155Proposal = (
    type: 'requiredNamespaces' | 'optionalNamespaces',
    chains: string[],
) =>
    makeProposal({
        requiredNamespaces: {},
        optionalNamespaces: {},
        [type]: {
            eip155: {
                chains,
                methods: ['eth_sendTransaction'],
                events: [],
            },
        },
    })

const approvedEip155 = (walletKit: ReturnType<typeof createFakeWalletKit>) =>
    (
        walletKit.approveSession.mock.calls[0][0].namespaces as Record<
            string,
            { chains: string[]; accounts: string[]; methods: string[] }
        >
    ).eip155

const heldOnBase = () =>
    makeSession({
        namespaces: {
            eip155: {
                chains: [BASE_MAINNET],
                accounts: [`${BASE_MAINNET}:${ETH}`],
                methods: ['eth_sendTransaction', 'wallet_switchEthereumChain'],
                events: ['accountsChanged', 'chainChanged'],
            },
        },
    })

const record = {
    id: TOPIC,
    kind: 'walletconnect-v2',
    name: 'Uniswap',
    peer: { name: 'Uniswap' },
    accounts: [ETH],
    status: 'active' as const,
    createdAt: 1,
    lastActiveAt: 1,
    metadata: {
        topic: TOPIC,
        chains: [BASE_MAINNET],
        methods: ['eth_sendTransaction'],
        expiry: 1_800_000_000,
    },
}

const liveOnBase = async (seed: Parameters<typeof memoryStore>[0] = [record]) =>
    await open(seed, createFakeWalletKit({ [TOPIC]: heldOnBase() }))

const request = async (
    opened: Awaited<ReturnType<typeof liveOnBase>>,
    overrides: Parameters<typeof makeRequest>[0],
) => {
    opened.walletKit.emit('session_request', makeRequest(overrides))
    await flush()
}

const switchTo = (hexChainId: string) => ({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: hexChainId }],
    chainId: BASE_MAINNET,
})

describe('chains sharing the eip155 namespace', () => {
    it('approves every connectable chain the proposal names in one namespace and leaves out one nobody serves', async () => {
        const { walletKit, proposals } = await open()
        walletKit.emit(
            'session_proposal',
            eip155Proposal('optionalNamespaces', [
                ETHEREUM_MAINNET,
                BASE_MAINNET,
                'eip155:130',
            ]),
        )
        await flush()

        await proposals[0].approve([ETH])

        const namespace = approvedEip155(walletKit)
        expect(namespace.chains).toEqual([ETHEREUM_MAINNET, BASE_MAINNET])
        expect(namespace.accounts).toEqual([
            `${ETHEREUM_MAINNET}:${ETH}`,
            `${BASE_MAINNET}:${ETH}`,
        ])
        expect(namespace.methods).toEqual([...new Set(namespace.methods)])
    })

    it('surfaces a proposal that requires chains of two different EVM adapters', async () => {
        const { walletKit, proposals, context } = await open()
        walletKit.emit(
            'session_proposal',
            eip155Proposal('requiredNamespaces', [
                ETHEREUM_MAINNET,
                BASE_MAINNET,
            ]),
        )
        await flush()

        expect(proposals).toHaveLength(1)
        expect(walletKit.rejectSession).not.toHaveBeenCalled()
        expect(context.onError).not.toHaveBeenCalled()
    })

    it('rejects a proposal requiring only a chain nobody serves, and tells the user without asking them to switch networks', async () => {
        const { walletKit, proposals, context } = await open()
        walletKit.emit(
            'session_proposal',
            eip155Proposal('requiredNamespaces', ['eip155:130']),
        )
        await flush()

        expect(proposals).toHaveLength(0)
        expect(walletKit.rejectSession).toHaveBeenCalledTimes(1)
        expect(context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectUnsupportedChainsError',
            }),
            expect.objectContaining({ pairingId: expect.any(String) }),
        )
    })

    it('routes a request to the chain that serves its CAIP-2 id', async () => {
        const opened = await liveOnBase()

        await request(opened, {
            method: 'eth_sendTransaction',
            params: [{ to: ETH }],
            chainId: BASE_MAINNET,
        })

        expect(opened.context.onMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                chainId: 'base',
                authorizedAccounts: [ETH],
            }),
        )
    })
})

describe('a switch to another chain of the namespace', () => {
    const lackingEthereum = async () => {
        const opened = await liveOnBase()
        await request(opened, switchTo('0x1'))
        const [message] = opened.context.onMessage.mock.calls[0] as unknown as [
            Extract<InboundMessage, { kind: 'request' }>,
        ]
        return { ...opened, message }
    }

    it('asks the user on the chain that owns the target, then adds its network to the session', async () => {
        const { walletKit, message } = await lackingEthereum()

        expect(message).toMatchObject({
            chainId: 'ethereum',
            rawOperation: {
                type: 'switch-network',
                params: { networkId: 'mainnet' },
            },
        })
        expect(walletKit.updateSession).not.toHaveBeenCalled()

        await message.respond({ type: 'switch-network' })

        const { namespaces } = walletKit.updateSession.mock.calls[0][0]
        expect(namespaces.eip155.chains).toEqual([
            BASE_MAINNET,
            ETHEREUM_MAINNET,
        ])
        expect(namespaces.eip155.accounts).toEqual([
            `${BASE_MAINNET}:${ETH}`,
            `${ETHEREUM_MAINNET}:${ETH}`,
        ])
        expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: { id: REQUEST_ID, jsonrpc: '2.0', result: null },
        })
    })

    it('answers at once, with no prompt, when the session already holds the target', async () => {
        const opened = await liveOnBase()

        await request(opened, switchTo('0x2105'))

        expect(opened.context.onMessage).not.toHaveBeenCalled()
        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: { id: REQUEST_ID, jsonrpc: '2.0', result: null },
        })
    })

    it('answers a held target at once even after its chain has dApp connections switched off', async () => {
        connectable.delete('ethereum')
        const both = [BASE_MAINNET, ETHEREUM_MAINNET]
        const opened = await open(
            [{ ...record, metadata: { ...record.metadata, chains: both } }],
            createFakeWalletKit({
                [TOPIC]: makeSession({
                    namespaces: {
                        eip155: {
                            chains: both,
                            accounts: both.map(caip2 => `${caip2}:${ETH}`),
                            methods: ['wallet_switchEthereumChain'],
                            events: [],
                        },
                    },
                }),
            }),
        )

        await request(opened, switchTo('0x1'))

        expect(opened.context.onMessage).not.toHaveBeenCalled()
        expect(opened.context.onError).not.toHaveBeenCalled()
        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: { id: REQUEST_ID, jsonrpc: '2.0', result: null },
        })
    })

    it('answers 4902 and tells the user when no chain serves the target', async () => {
        const opened = await liveOnBase()

        await request(opened, switchTo('0x82'))

        expect(opened.context.onMessage).not.toHaveBeenCalled()
        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({ code: 4902 }),
            },
        })
        expect(opened.context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectUnsupportedNetworkError',
                metadata: expect.objectContaining({
                    params: { dappName: 'Uniswap', chainId: '130' },
                }),
            }),
            { connectionId: TOPIC },
        )
    })

    it('treats a chain with dApp connections off, which the session lacks, as unserved', async () => {
        connectable.delete('ethereum')
        const opened = await liveOnBase()

        await request(opened, switchTo('0x1'))

        expect(opened.context.onMessage).not.toHaveBeenCalled()
        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({ code: 4902 }),
            },
        })
        expect(opened.context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectUnsupportedNetworkError',
            }),
            { connectionId: TOPIC },
        )
    })

    it('answers 4901 for a served network the wallet has not selected', async () => {
        const opened = await liveOnBase()

        await request(opened, switchTo('0x14a34'))

        expect(opened.context.onMessage).not.toHaveBeenCalled()
        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: expect.objectContaining({ code: 4901 }),
            },
        })
        expect(opened.context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectInvalidNetworkError',
            }),
            { connectionId: TOPIC },
        )
    })
})

describe('telling the user a request was declined', () => {
    it('names the dApp and the method when the chain asks for it', async () => {
        const opened = await liveOnBase()

        await request(opened, {
            method: 'eth_sign',
            params: [],
            chainId: BASE_MAINNET,
        })

        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledWith({
            topic: TOPIC,
            response: {
                id: REQUEST_ID,
                jsonrpc: '2.0',
                error: { code: 4200, message: 'Not served' },
            },
        })
        expect(opened.context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectUnsupportedMethodError',
                metadata: expect.objectContaining({
                    params: { dappName: 'Uniswap', method: 'eth_sign' },
                }),
            }),
            { connectionId: TOPIC },
        )
    })

    it('names a method the chain does not list at all', async () => {
        const opened = await liveOnBase()

        await request(opened, {
            method: 'wallet_watchAsset',
            params: [],
            chainId: BASE_MAINNET,
        })

        expect(opened.context.onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'WalletConnectUnsupportedMethodError',
                metadata: expect.objectContaining({
                    params: {
                        dappName: 'Uniswap',
                        method: 'wallet_watchAsset',
                    },
                }),
            }),
            { connectionId: TOPIC },
        )
    })

    it('stays silent for a refusal the chain does not flag', async () => {
        const opened = await liveOnBase()

        await request(opened, {
            method: 'wallet_getPermissions',
            params: [],
            chainId: BASE_MAINNET,
        })

        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledTimes(1)
        expect(opened.context.onError).not.toHaveBeenCalled()
    })

    it('answers the dApp but shows nothing when no record names it', async () => {
        const opened = await liveOnBase([])

        await request(opened, {
            method: 'eth_sign',
            params: [],
            chainId: BASE_MAINNET,
        })

        expect(opened.walletKit.respondSessionRequest).toHaveBeenCalledTimes(1)
        expect(opened.context.onError).not.toHaveBeenCalled()
    })
})

describe('accountsChanged on a shared namespace', () => {
    const sessionOn = (...chains: string[]) =>
        makeSession({
            namespaces: {
                eip155: {
                    chains,
                    accounts: chains.map(caip2 => `${caip2}:${ETH}`),
                    methods: ['eth_sendTransaction'],
                    events: ['accountsChanged', 'chainChanged'],
                },
            },
        })

    const removed = (chainId: ChainId): WalletNotice => ({
        type: 'accounts-changed',
        chainId,
        accounts: [],
        changed: [ETH],
    })

    it('has each chain announce on a chain id it owns, so one removal is heard once per chain the session holds', async () => {
        const { handler, walletKit } = await open(
            [record],
            createFakeWalletKit({
                [TOPIC]: sessionOn(ETHEREUM_MAINNET, BASE_MAINNET),
            }),
        )

        await handler.notify?.(TOPIC, removed('ethereum'))
        await handler.notify?.(TOPIC, removed('base'))

        expect(
            walletKit.emitSessionEvent.mock.calls.map(([call]) => call.chainId),
        ).toEqual([ETHEREUM_MAINNET, BASE_MAINNET])
    })

    it('stays silent for a chain that owns none of the session’s chains', async () => {
        const { handler, walletKit } = await open(
            [record],
            createFakeWalletKit({ [TOPIC]: sessionOn(ETHEREUM_MAINNET) }),
        )

        await handler.notify?.(TOPIC, removed('base'))

        expect(walletKit.emitSessionEvent).not.toHaveBeenCalled()
    })
})
