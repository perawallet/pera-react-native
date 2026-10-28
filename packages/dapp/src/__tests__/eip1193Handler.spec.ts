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
import {
    ConnectionsError,
    createConnectionRegistry,
    dappRequestChainAdapters,
    DappRequestRejectedError,
    type ConnectionProposal,
    type DappMessageRequest,
    type DappRequestChainAdapter,
    type DappRequestFailure,
    type InboundMessage,
} from '@perawallet/wallet-core-connections'
import { memoryStore } from '@perawallet/wallet-core-connections/testing'
import type { ChainId, NetworkId } from '@perawallet/wallet-core-chain-contract'
import type { Connection } from '@perawallet/wallet-extension-connections'
import type { JsonRpcResponse } from '../codec'
import { createEip1193ConnectionHandler } from '../eip1193Handler'
import {
    EIP1193_DAPP_KIND,
    EIP1193_ERROR_CODE,
    EIP1193_PERMISSION_METHODS,
} from '../eip1193Protocol'
import { eip1193ConnectionIdOf, type Eip1193Connection } from '../models'
import { DAPP_KIND } from '../protocol'
import { FakeDappTransport } from './fake-transport'

const ORIGIN = 'https://swap.example'
const ID = eip1193ConnectionIdOf(ORIGIN)
const ADDR_X = `0x${'a'.repeat(40)}`
const ADDR_Y = `0x${'b'.repeat(40)}`
const ADDR_GONE = `0x${'c'.repeat(40)}`

const realSetTimeout = globalThis.setTimeout
const flush = (): Promise<void> =>
    new Promise(resolve => realSetTimeout(resolve, 0))

const errorOf = (response: JsonRpcResponse) =>
    'error' in response ? response.error : undefined
const resultOf = (response: JsonRpcResponse) =>
    'result' in response ? response.result : undefined

const EIP_1193_CODE: Record<DappRequestFailure, number> = {
    'user-rejected': 4001,
    'unauthorized-account': 4100,
    'unsupported-method': 4200,
    'unselected-chain': 4901,
    'invalid-params': -32_602,
    'limit-exceeded': -32_005,
}

const toHex = (bytes: Uint8Array): string =>
    `0x${[...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')}`

const CAIP2: Record<string, Record<string, string>> = {
    ethereum: { mainnet: 'eip155:1', sepolia: 'eip155:11155111' },
    base: { mainnet: 'eip155:8453' },
}

const fakeAdapter = (
    chainId: ChainId,
    namespace = 'eip155',
): DappRequestChainAdapter => ({
    chainId,
    relayableErrorNames: [],
    accountTypeOf: () => 'Fixture',
    parseSigningParams: () => ({
        ok: false,
        reason: 'missing',
        message: 'unused',
    }),
    resolveReportedNetwork: scope => scope.networkId,
    emptySignaturesFor: () => ({}),
    walletConnect: {
        namespace,
        caip2ChainIdFor: networkId => CAIP2[chainId]?.[networkId] ?? null,
        networkForCaip2ChainId: () => null,
        toWireResult: result => {
            if (result.type === 'send-transaction') return result.txId
            if (
                result.type === 'sign-message' ||
                result.type === 'sign-typed-data'
            ) {
                return toHex(result.signature)
            }
            return null
        },
        toWireErrorCode: failure => EIP_1193_CODE[failure],
        v2: {
            methods: [],
            signingMethods: [
                'eth_sendTransaction',
                'personal_sign',
                'eth_signTypedData_v4',
                'wallet_switchEthereumChain',
            ],
            handleRequest: (method, params) => {
                switch (method) {
                    case 'eth_sendTransaction': {
                        return {
                            kind: 'operation',
                            type: 'send-transaction',
                            params: Array.isArray(params) ? params[0] : params,
                        }
                    }
                    case 'personal_sign': {
                        return {
                            kind: 'operation',
                            type: 'sign-message',
                            params,
                        }
                    }
                    case 'eth_signTypedData_v4': {
                        return {
                            kind: 'operation',
                            type: 'sign-typed-data',
                            params,
                        }
                    }
                    default: {
                        return { kind: 'unsupported' }
                    }
                }
            },
        },
    },
    validateTransactionPayload: () => ({ ok: false, message: 'unused' }),
    sendTransaction: {
        validate: params => ({ ok: true, request: params }),
        build: () => Promise.reject(new Error('unused')),
    },
    validateMessagePayload: (_type, params) => ({
        ok: true,
        request: params as DappMessageRequest,
    }),
    useEnqueueTransactionSigning: () => async () => null,
})

type SetupOptions = {
    networks?: Partial<Record<ChainId, NetworkId>>
    disabled?: ChainId[]
    isSiteFlagged?: (origin: string) => Promise<boolean>
}

const setup = (seed: Connection[] = [], options: SetupOptions = {}) => {
    dappRequestChainAdapters.register(fakeAdapter('algorand', 'algorand'))
    dappRequestChainAdapters.register(fakeAdapter('ethereum'))
    dappRequestChainAdapters.register(fakeAdapter('base'))
    const transport = new FakeDappTransport()
    const store = memoryStore(seed)
    const networks: Partial<Record<ChainId, NetworkId>> = {
        algorand: 'mainnet',
        ethereum: 'mainnet',
        base: 'mainnet',
        ...options.networks,
    }
    const disabled = new Set(options.disabled ?? [])
    const accounts: Record<string, string[]> = {
        ethereum: [ADDR_X, ADDR_Y],
        base: [ADDR_X],
    }
    const handler = createEip1193ConnectionHandler({
        transport,
        getNetworkId: chainId => networks[chainId] ?? 'mainnet',
        isDappConnectEnabled: chainId => !disabled.has(chainId),
        getAccounts: chainId =>
            (accounts[chainId] ?? []).map(address => ({
                address,
                name: address,
            })),
        isSiteFlagged: options.isSiteFlagged,
        now: () => 1_000_000,
        proposalTtlMs: 1_000,
        requestTtlMs: 1_000,
        approvalTtlMs: 60_000,
    })
    const registry = createConnectionRegistry({ store })
    registry.register(handler)
    const proposals: ConnectionProposal[] = []
    registry.subscribeToProposals(p => proposals.push(p))
    const messages: InboundMessage[] = []
    registry.subscribeToMessages(m => messages.push(m))
    return {
        transport,
        store,
        handler,
        registry,
        proposals,
        messages,
        networks,
        disabled,
        accounts,
    }
}

const connectedOn = (
    chainId: ChainId,
    accounts: string[] = [ADDR_X],
): Eip1193Connection => ({
    id: ID,
    kind: EIP1193_DAPP_KIND,
    name: 'swap.example',
    peer: { name: 'swap.example', url: ORIGIN },
    accounts,
    status: 'active',
    createdAt: 1,
    lastActiveAt: 1,
    metadata: { chainId },
    origin: { requesterOrigin: ORIGIN },
})

const notificationsOf = (transport: FakeDappTransport, method: string) =>
    transport.notifications
        .filter(({ notification }) => notification.method === method)
        .map(({ origin, notification }) => ({
            origin,
            params: notification.params,
        }))

describe('createEip1193ConnectionHandler', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        dappRequestChainAdapters.reset()
    })

    describe('eth_chainId', () => {
        it('reports the first served eip155 chain before any connection', async () => {
            const { transport, registry } = setup()
            await registry.initialize()
            expect(resultOf(await transport.send(ORIGIN, 'eth_chainId'))).toBe(
                '0x1',
            )
        })

        it('skips a chain whose dApp connections are switched off', async () => {
            const { transport, registry } = setup([], {
                disabled: ['ethereum'],
            })
            await registry.initialize()
            expect(resultOf(await transport.send(ORIGIN, 'eth_chainId'))).toBe(
                '0x2105',
            )
        })

        it('answers disconnected when no eip155 chain is served', async () => {
            const { transport, registry } = setup([], {
                disabled: ['ethereum', 'base'],
            })
            await registry.initialize()
            expect(
                errorOf(await transport.send(ORIGIN, 'eth_chainId'))?.code,
            ).toBe(EIP1193_ERROR_CODE.disconnected)
        })

        it('reports the connection’s own chain on the wallet’s selected network', async () => {
            const { transport, registry } = setup([connectedOn('ethereum')], {
                networks: { ethereum: 'sepolia' },
            })
            await registry.initialize()
            expect(resultOf(await transport.send(ORIGIN, 'eth_chainId'))).toBe(
                '0xaa36a7',
            )
        })
    })

    describe('eth_accounts', () => {
        it('is empty before any approval', async () => {
            const { transport, registry } = setup()
            await registry.initialize()
            expect(
                resultOf(await transport.send(ORIGIN, 'eth_accounts')),
            ).toEqual([])
        })

        it('reports only approved accounts that can still sign on the site’s chain', async () => {
            const { transport, registry } = setup([
                connectedOn('ethereum', [ADDR_X, ADDR_GONE]),
            ])
            await registry.initialize()
            expect(
                resultOf(await transport.send(ORIGIN, 'eth_accounts')),
            ).toEqual([ADDR_X])
        })
    })

    describe('eth_requestAccounts', () => {
        it('proposes on the default chain naming the verified origin, and shares only the chosen signable accounts', async () => {
            const { transport, registry, proposals, store } = setup()
            await registry.initialize()
            const pending = transport.send(ORIGIN, 'eth_requestAccounts')
            await flush()

            expect(proposals).toHaveLength(1)
            const [proposal] = proposals
            expect(proposal.kind).toBe(EIP1193_DAPP_KIND)
            expect(proposal.requesterOrigin).toBe(ORIGIN)
            expect(proposal.peer).toEqual({
                name: 'swap.example',
                url: ORIGIN,
            })
            expect(proposal.requested).toEqual({
                networks: ['mainnet'],
                chains: ['ethereum'],
                methods: [...EIP1193_PERMISSION_METHODS],
            })

            const connection = await proposal.approve([ADDR_Y, ADDR_GONE])
            expect(connection.id).toBe(ID)
            expect(connection.metadata).toEqual({ chainId: 'ethereum' })
            expect((await store.get(ID))?.accounts).toEqual([ADDR_Y])
            expect(resultOf(await pending)).toEqual([ADDR_Y])
            expect(notificationsOf(transport, 'accountsChanged')).toEqual([
                { origin: ORIGIN, params: [ADDR_Y] },
            ])
        })

        it('returns the user-rejected error when the user declines', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            const pending = transport.send(ORIGIN, 'eth_requestAccounts')
            await flush()
            await proposals[0].reject()
            expect(errorOf(await pending)?.code).toBe(
                EIP1193_ERROR_CODE.userRejected,
            )
            expect(
                resultOf(await transport.send(ORIGIN, 'eth_accounts')),
            ).toEqual([])
        })

        it('refuses a first request made without a user gesture', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'eth_requestAccounts',
                undefined,
                { hasUserActivation: false },
            )
            expect(errorOf(response)?.code).toBe(
                EIP1193_ERROR_CODE.unauthorized,
            )
            expect(proposals).toHaveLength(0)
        })

        it('refuses a second request while one is pending for the site', async () => {
            const { transport, registry } = setup()
            await registry.initialize()
            void transport.send(ORIGIN, 'eth_requestAccounts')
            const second = await transport.send(ORIGIN, 'eth_requestAccounts')
            expect(errorOf(second)?.code).toBe(
                EIP1193_ERROR_CODE.resourceUnavailable,
            )
        })

        it('answers an expired approval as rejected and frees the site', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            const pending = transport.send(ORIGIN, 'eth_requestAccounts')
            await flush()
            vi.advanceTimersByTime(1_000)
            expect(errorOf(await pending)?.code).toBe(
                EIP1193_ERROR_CODE.userRejected,
            )
            void transport.send(ORIGIN, 'eth_requestAccounts')
            await flush()
            expect(proposals).toHaveLength(2)
        })

        it('answers a connected site without asking again', async () => {
            const { transport, registry, proposals } = setup([
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'eth_requestAccounts',
                undefined,
                { hasUserActivation: false },
            )
            expect(resultOf(response)).toEqual([ADDR_X])
            expect(proposals).toHaveLength(0)
        })

        it('sends a flagged site that was already connected back through an approval', async () => {
            const isSiteFlagged = vi.fn(async () => true)
            const { transport, registry, proposals } = setup(
                [connectedOn('ethereum')],
                { isSiteFlagged },
            )
            await registry.initialize()

            void transport.send(ORIGIN, 'eth_requestAccounts')
            await flush()

            expect(isSiteFlagged).toHaveBeenCalledWith(ORIGIN)
            expect(proposals).toHaveLength(1)
        })

        it('refuses a flagged site a gesture-free reconnect', async () => {
            const { transport, registry, proposals } = setup(
                [connectedOn('ethereum')],
                { isSiteFlagged: async () => true },
            )
            await registry.initialize()

            const response = await transport.send(
                ORIGIN,
                'eth_requestAccounts',
                undefined,
                { hasUserActivation: false },
            )

            expect(errorOf(response)?.code).toBe(
                EIP1193_ERROR_CODE.unauthorized,
            )
            expect(proposals).toHaveLength(0)
        })

        it('still answers an unflagged connected site silently', async () => {
            const { transport, registry, proposals } = setup(
                [connectedOn('ethereum')],
                { isSiteFlagged: async () => false },
            )
            await registry.initialize()

            const response = await transport.send(
                ORIGIN,
                'eth_requestAccounts',
                undefined,
                { hasUserActivation: false },
            )

            expect(resultOf(response)).toEqual([ADDR_X])
            expect(proposals).toHaveLength(0)
        })

        it('asks again on the site’s chain when none of its accounts can sign there', async () => {
            const { transport, registry, proposals } = setup([
                connectedOn('base', [ADDR_Y]),
            ])
            await registry.initialize()
            void transport.send(ORIGIN, 'eth_requestAccounts')
            await flush()
            expect(proposals[0].requested.chains).toEqual(['base'])
        })

        it('refuses a gesture-free request that would open an approval for a site left with no accounts', async () => {
            const { transport, registry, proposals } = setup([
                connectedOn('base', [ADDR_Y]),
            ])
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'eth_requestAccounts',
                undefined,
                { hasUserActivation: false },
            )
            expect(errorOf(response)?.code).toBe(
                EIP1193_ERROR_CODE.unauthorized,
            )
            expect(proposals).toHaveLength(0)
        })

        it('proposes only on a chain whose dApp connections are on', async () => {
            const { transport, registry, proposals } = setup([], {
                disabled: ['ethereum'],
            })
            await registry.initialize()
            void transport.send(ORIGIN, 'eth_requestAccounts')
            await flush()
            expect(proposals[0].requested.chains).toEqual(['base'])
        })

        it('answers disconnected and opens nothing when every chain’s dApp connections are off', async () => {
            const { transport, registry, proposals } = setup([], {
                disabled: ['ethereum', 'base'],
            })
            await registry.initialize()
            const response = await transport.send(ORIGIN, 'eth_requestAccounts')
            expect(errorOf(response)?.code).toBe(
                EIP1193_ERROR_CODE.disconnected,
            )
            expect(proposals).toHaveLength(0)
        })

        it('keeps the same site’s window.pera record apart', async () => {
            const algorand: Connection = {
                ...connectedOn('ethereum'),
                id: ORIGIN,
                kind: DAPP_KIND,
                metadata: undefined,
                origin: undefined,
            }
            const { transport, registry, proposals, store } = setup([algorand])
            await registry.initialize()
            void transport.send(ORIGIN, 'eth_requestAccounts')
            await flush()
            await proposals[0].approve([ADDR_X])
            expect((await store.get(ORIGIN))?.kind).toBe(DAPP_KIND)
            await registry.disconnect(ID)
            expect(await store.get(ORIGIN)).toBeDefined()
            expect(await store.get(ID)).toBeUndefined()
        })
    })

    describe('wallet_switchEthereumChain', () => {
        const switchTo = (transport: FakeDappTransport, chainId: unknown) =>
            transport.send(ORIGIN, 'wallet_switchEthereumChain', [{ chainId }])

        it('refuses params without a hex chain id', async () => {
            const { transport, registry } = setup([connectedOn('ethereum')])
            await registry.initialize()
            expect(errorOf(await switchTo(transport, 8453))?.code).toBe(
                EIP1193_ERROR_CODE.invalidParams,
            )
        })

        it('refuses a site that is not connected', async () => {
            const { transport, registry } = setup()
            await registry.initialize()
            expect(errorOf(await switchTo(transport, '0x2105'))?.code).toBe(
                EIP1193_ERROR_CODE.unauthorized,
            )
        })

        it('answers unrecognised for a chain Pera does not serve right now', async () => {
            const { transport, registry, messages } = setup(
                [connectedOn('ethereum')],
                { disabled: ['base'] },
            )
            await registry.initialize()
            expect(errorOf(await switchTo(transport, '0x89'))?.code).toBe(
                EIP1193_ERROR_CODE.unrecognizedChain,
            )
            expect(errorOf(await switchTo(transport, '0x2105'))?.code).toBe(
                EIP1193_ERROR_CODE.unrecognizedChain,
            )
            // Pera has Sepolia, but the wallet is on mainnet for Ethereum.
            expect(errorOf(await switchTo(transport, '0xaa36a7'))?.code).toBe(
                EIP1193_ERROR_CODE.unrecognizedChain,
            )
            expect(messages).toHaveLength(0)
        })

        it('answers at once when the site is already on the chain', async () => {
            const { transport, registry, messages } = setup([
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            expect(resultOf(await switchTo(transport, '0x01'))).toBeNull()
            expect(messages).toHaveLength(0)
        })

        it('asks the user, then moves only this site and reports the new chain', async () => {
            const { transport, registry, messages, store } = setup([
                connectedOn('ethereum', [ADDR_X, ADDR_Y]),
            ])
            await registry.initialize()
            const pending = switchTo(transport, '0x2105')
            await flush()

            expect(messages).toHaveLength(1)
            const message = messages[0]
            if (message.kind !== 'request') throw new Error('not a request')
            expect(message.chainId).toBe('base')
            expect(message.operation).toEqual({
                type: 'switch-network',
                networkId: 'mainnet',
            })
            expect(message.verifiedOrigin).toBe(ORIGIN)

            await message.respond({ type: 'switch-network' })
            expect(resultOf(await pending)).toBeNull()
            expect((await store.get(ID))?.metadata).toEqual({
                chainId: 'base',
            })
            expect(notificationsOf(transport, 'chainChanged')).toEqual([
                { origin: ORIGIN, params: '0x2105' },
            ])
            // ADDR_Y has no Base entry, so the site now sees only ADDR_X.
            expect(notificationsOf(transport, 'accountsChanged')).toEqual([
                { origin: ORIGIN, params: [ADDR_X] },
            ])
        })

        it('returns the user-rejected error when the user declines', async () => {
            const { transport, registry, messages, store } = setup([
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            const pending = switchTo(transport, '0x2105')
            await flush()
            const message = messages[0]
            if (message.kind !== 'request') throw new Error('not a request')
            await message.reject(new DappRequestRejectedError())
            expect(errorOf(await pending)?.code).toBe(
                EIP1193_ERROR_CODE.userRejected,
            )
            expect((await store.get(ID))?.metadata).toEqual({
                chainId: 'ethereum',
            })
        })

        it('declines when the target stopped being served while the prompt was open', async () => {
            const { transport, registry, messages, store, networks } = setup([
                connectedOn('base'),
            ])
            await registry.initialize()
            const pending = switchTo(transport, '0x1')
            await flush()
            networks.ethereum = 'sepolia'
            const message = messages[0]
            if (message.kind !== 'request') throw new Error('not a request')
            await expect(
                message.respond({ type: 'switch-network' }),
            ).rejects.toThrow()
            await message.reject(new Error('The chain is no longer available'))
            expect(errorOf(await pending)?.code).toBe(
                EIP1193_ERROR_CODE.internal,
            )
            expect((await store.get(ID))?.metadata).toEqual({
                chainId: 'base',
            })
        })

        it('keeps an approved switch when the requesting tab has gone, and never expires it later', async () => {
            const { transport, registry, messages, store } = setup([
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            void switchTo(transport, '0x2105')
            await flush()
            const message = messages[0]
            if (message.kind !== 'request') throw new Error('not a request')
            transport.setReachable(ORIGIN, false)

            await expect(
                message.respond({ type: 'switch-network' }),
            ).resolves.toBeUndefined()
            vi.advanceTimersByTime(1_000)
            await flush()

            expect((await store.get(ID))?.metadata).toEqual({
                chainId: 'base',
            })
            expect(messages.map(({ kind }) => kind)).not.toContain(
                'request-expired',
            )
        })

        it('allows a chain no shared account can use, leaving the site with no accounts', async () => {
            const { transport, registry, messages } = setup([
                connectedOn('ethereum', [ADDR_Y]),
            ])
            await registry.initialize()
            const pending = switchTo(transport, '0x2105')
            await flush()
            const message = messages[0]
            if (message.kind !== 'request') throw new Error('not a request')
            await message.respond({ type: 'switch-network' })
            await pending
            expect(notificationsOf(transport, 'accountsChanged')).toEqual([
                { origin: ORIGIN, params: [] },
            ])
        })
    })

    describe('other methods', () => {
        it('refuses to add a chain', async () => {
            const { transport, registry } = setup([connectedOn('ethereum')])
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'wallet_addEthereumChain',
                [{ chainId: '0x539' }],
            )
            expect(errorOf(response)?.code).toBe(
                EIP1193_ERROR_CODE.unsupportedMethod,
            )
        })

        it('wallet_revokePermissions disconnects the site and tells its tabs', async () => {
            const { transport, registry, store } = setup([
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'wallet_revokePermissions',
                [{ eth_accounts: {} }],
            )
            expect(resultOf(response)).toBeNull()
            expect(await store.get(ID)).toBeUndefined()
            expect(notificationsOf(transport, 'accountsChanged')).toEqual([
                { origin: ORIGIN, params: [] },
            ])
            expect(
                resultOf(await transport.send(ORIGIN, 'eth_accounts')),
            ).toEqual([])
        })
    })

    describe('signing requests', () => {
        type RaisedRequest = Extract<InboundMessage, { kind: 'request' }>
        const requestOf = (messages: InboundMessage[]): RaisedRequest => {
            const [message] = messages
            if (message?.kind !== 'request') throw new Error('not a request')
            return message
        }
        const raise = async (method = 'personal_sign') => {
            const context = setup([
                connectedOn('ethereum', [ADDR_X, ADDR_GONE]),
            ])
            await context.registry.initialize()
            const pending = context.transport.send(ORIGIN, method, [
                { from: ADDR_X },
            ])
            await flush()
            return { ...context, pending, message: requestOf(context.messages) }
        }

        it.each([
            ['eth_sendTransaction', 'send-transaction'],
            ['personal_sign', 'sign-message'],
            ['eth_signTypedData_v4', 'sign-typed-data'],
        ])(
            '%s from a connected site raises one injected request on the site chain',
            async (method, type) => {
                const { messages, message } = await raise(method)
                expect(messages).toHaveLength(1)
                expect(message.sourceType).toBe('injected')
                expect(message.chainId).toBe('ethereum')
                expect(message.connectionId).toBe(ID)
                expect(message.verifiedOrigin).toBe(ORIGIN)
                expect(message.authorizedAccounts).toEqual([ADDR_X])
                expect(message.operation.type).toBe(type)
            },
        )

        it('answers eth_sendTransaction with the tx hash', async () => {
            const { pending, message } = await raise('eth_sendTransaction')
            await message.respond({ type: 'send-transaction', txId: '0xabc' })
            expect(resultOf(await pending)).toBe('0xabc')
        })

        it('answers personal_sign with the hex signature', async () => {
            const { pending, message } = await raise('personal_sign')
            await message.respond({
                type: 'sign-message',
                signature: Uint8Array.of(1, 2),
            })
            expect(resultOf(await pending)).toBe('0x0102')
        })

        it.each([
            'eth_sign',
            'eth_signTransaction',
            'eth_sendRawTransaction',
            'wallet_sendCalls',
        ])('%s is refused with 4200 and never raised', async method => {
            const { transport, registry, messages } = setup([
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            expect(errorOf(await transport.send(ORIGIN, method))?.code).toBe(
                EIP1193_ERROR_CODE.unsupportedMethod,
            )
            expect(messages).toHaveLength(0)
        })

        it('answers a route the chain refuses with its error verbatim', async () => {
            const { transport, registry, messages } = setup([
                connectedOn('ethereum'),
            ])
            const adapter = dappRequestChainAdapters.get('ethereum')
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register({
                ...adapter,
                walletConnect: {
                    ...adapter.walletConnect,
                    v2: {
                        methods: [],
                        signingMethods: ['personal_sign'],
                        handleRequest: () => ({
                            kind: 'refused',
                            error: { code: -32_602, message: 'Bad params' },
                        }),
                    },
                },
            })
            await registry.initialize()
            expect(
                errorOf(await transport.send(ORIGIN, 'personal_sign')),
            ).toEqual({
                code: -32_602,
                message: 'Bad params',
            })
            expect(messages).toHaveLength(0)
        })

        it('a signing request from an unconnected site gets 4100 and is never raised', async () => {
            const { transport, registry, messages } = setup()
            await registry.initialize()
            expect(
                errorOf(await transport.send(ORIGIN, 'personal_sign'))?.code,
            ).toBe(EIP1193_ERROR_CODE.unauthorized)
            expect(messages).toHaveLength(0)
        })

        it('an unconnected site calling eth_call gets 4200', async () => {
            const { transport, registry, messages } = setup()
            await registry.initialize()
            expect(
                errorOf(await transport.send(ORIGIN, 'eth_call'))?.code,
            ).toBe(EIP1193_ERROR_CODE.unsupportedMethod)
            expect(messages).toHaveLength(0)
        })

        it('a signing request on a chain no longer served gets 4901 and is never raised', async () => {
            const { transport, registry, messages } = setup(
                [connectedOn('ethereum')],
                { networks: { ethereum: 'holesky' } },
            )
            await registry.initialize()
            expect(
                errorOf(await transport.send(ORIGIN, 'personal_sign'))?.code,
            ).toBe(EIP1193_ERROR_CODE.chainDisconnected)
            expect(messages).toHaveLength(0)
        })

        it('a validation refusal for an account the site was not given answers 4100', async () => {
            const { pending, message } = await raise()
            await message.reject(
                new ConnectionsError('unauthorized-account', 'x'),
            )
            expect(errorOf(await pending)?.code).toBe(
                EIP1193_ERROR_CODE.unauthorized,
            )
        })

        it('a declined approval answers 4001', async () => {
            const { pending, message } = await raise()
            await message.reject(new DappRequestRejectedError())
            expect(errorOf(await pending)?.code).toBe(
                EIP1193_ERROR_CODE.userRejected,
            )
        })

        it('an unexpected failure answers -32603 without leaking its message', async () => {
            const { pending, message } = await raise()
            await message.reject(new Error('/private/keystore path'))
            const error = errorOf(await pending)
            expect(error?.code).toBe(EIP1193_ERROR_CODE.internal)
            expect(error?.message).not.toContain('keystore')
        })

        // An expiry would withdraw the window under a broadcast that still
        // goes out, telling the page no to a transaction already on chain.
        it('keeps a request on screen past the queue TTL, and takes its late answer', async () => {
            const { pending, message, messages } = await raise()
            vi.advanceTimersByTime(10_000)
            await flush()
            expect(messages.map(({ kind }) => kind)).not.toContain(
                'request-expired',
            )

            await message.respond({
                type: 'sign-message',
                signature: Uint8Array.of(1),
            })

            expect(resultOf(await pending)).toBe('0x01')
        })

        it('expires a request on screen after approvalTtlMs and withdraws its window', async () => {
            const { pending, message, messages } = await raise()
            vi.advanceTimersByTime(60_000)
            await flush()

            expect(errorOf(await pending)).toEqual({
                code: EIP1193_ERROR_CODE.internal,
                message: 'The wallet did not answer in time',
            })
            expect(messages).toContainEqual(
                expect.objectContaining({
                    kind: 'request-expired',
                    correlationId: message.correlationId,
                }),
            )
            await expect(
                message.respond({
                    type: 'sign-message',
                    signature: Uint8Array.of(1),
                }),
            ).rejects.toThrow()
        })

        it('a committed send outlives approvalTtlMs and is answered with its hash', async () => {
            const { pending, message, messages } = await raise(
                'eth_sendTransaction',
            )

            message.commit?.()
            vi.advanceTimersByTime(60_001)
            await flush()

            expect(messages.map(({ kind }) => kind)).not.toContain(
                'request-expired',
            )
            await message.respond({ type: 'send-transaction', txId: '0xabc' })
            expect(resultOf(await pending)).toBe('0xabc')
        })

        it('revoking the site leaves a committed send to its broadcast', async () => {
            const { pending, message, messages, registry, transport } =
                await raise('eth_sendTransaction')
            const queued = transport.send(ORIGIN, 'personal_sign', [
                '0x68656c6c6f',
                ADDR_X,
            ])
            await flush()
            let isSettled = false
            void pending.then(() => {
                isSettled = true
            })

            message.commit?.()
            await registry.disconnect(ID)
            await flush()

            expect(errorOf(await queued)?.code).toBe(
                EIP1193_ERROR_CODE.unauthorized,
            )
            expect(isSettled).toBe(false)
            expect(messages).not.toContainEqual(
                expect.objectContaining({
                    kind: 'request-expired',
                    correlationId: message.correlationId,
                }),
            )
            await message.respond({ type: 'send-transaction', txId: '0xabc' })
            expect(resultOf(await pending)).toBe('0xabc')
        })

        it('committing an answered request leaves the next one’s expiry alone', async () => {
            const { message, messages, transport } = await raise(
                'eth_sendTransaction',
            )
            const next = transport.send(ORIGIN, 'personal_sign', [
                '0x68656c6c6f',
                ADDR_X,
            ])
            await flush()
            await message.respond({ type: 'send-transaction', txId: '0xabc' })
            await flush()

            message.commit?.()
            vi.advanceTimersByTime(60_001)
            await flush()

            expect(errorOf(await next)?.code).toBe(EIP1193_ERROR_CODE.internal)
            expect(
                messages.filter(({ kind }) => kind === 'request'),
            ).toHaveLength(2)
        })

        it('answers a signing method no page backstop covers with 4200', async () => {
            const { transport, registry, messages } = setup([
                connectedOn('ethereum'),
            ])
            const adapter = dappRequestChainAdapters.get('ethereum')
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register({
                ...adapter,
                walletConnect: {
                    ...adapter.walletConnect,
                    v2: {
                        methods: [],
                        signingMethods: ['eth_signUserOperation'],
                        handleRequest: () => ({
                            kind: 'operation',
                            type: 'sign-message',
                            params: [],
                        }),
                    },
                },
            })
            await registry.initialize()
            expect(
                errorOf(await transport.send(ORIGIN, 'eth_signUserOperation'))
                    ?.code,
            ).toBe(EIP1193_ERROR_CODE.unsupportedMethod)
            expect(messages).toHaveLength(0)
        })

        it('refuses an answer that arrives after the request was answered', async () => {
            const { pending, message } = await raise()
            await message.reject(new DappRequestRejectedError())
            await pending
            await expect(
                message.respond({
                    type: 'sign-message',
                    signature: Uint8Array.of(1),
                }),
            ).rejects.toThrow()
        })
    })

    describe('signing queue', () => {
        type RaisedRequest = Extract<InboundMessage, { kind: 'request' }>
        const ORIGIN_B = 'https://lend.example'
        const raisedOf = (messages: InboundMessage[]): RaisedRequest[] =>
            messages.filter(
                (message): message is RaisedRequest =>
                    message.kind === 'request',
            )
        const siteOn = (
            origin: string,
            accounts: string[] = [ADDR_X],
        ): Eip1193Connection => ({
            ...connectedOn('ethereum', accounts),
            id: eip1193ConnectionIdOf(origin),
            peer: { name: new URL(origin).host, url: origin },
            origin: { requesterOrigin: origin },
        })
        const track = (pending: Promise<JsonRpcResponse>) => {
            const state: { response?: JsonRpcResponse } = {}
            void pending.then(response => {
                state.response = response
            })
            return state
        }
        const connected = async (seed: Connection[] = [siteOn(ORIGIN)]) => {
            const context = setup(seed)
            await context.registry.initialize()
            const sign = (origin = ORIGIN, from = ADDR_X) =>
                track(
                    context.transport.send(origin, 'eth_sendTransaction', [
                        { from },
                    ]),
                )
            return { ...context, sign }
        }
        const signed = { type: 'send-transaction', txId: '0xabc' } as const

        it('a second request from the same site waits until the first is answered', async () => {
            const { messages, sign } = await connected()
            const first = sign()
            const second = sign()
            await flush()
            expect(raisedOf(messages)).toHaveLength(1)
            expect(second.response).toBeUndefined()

            await raisedOf(messages)[0]!.respond(signed)
            await flush()

            expect(resultOf(first.response!)).toBe('0xabc')
            expect(raisedOf(messages)).toHaveLength(2)
        })

        it('two tabs of the same site share one queue', async () => {
            const { transport, messages } = await connected()
            void transport.send(ORIGIN, 'personal_sign', [], {
                faviconUrl: `${ORIGIN}/a.ico`,
            })
            void transport.send(ORIGIN, 'personal_sign', [], {
                faviconUrl: `${ORIGIN}/b.ico`,
            })
            await flush()
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('a switch waits behind the request on screen, so the chain never moves under it', async () => {
            const { transport, messages, store, sign } = await connected()
            const send = sign()
            const switched = track(
                transport.send(ORIGIN, 'wallet_switchEthereumChain', [
                    { chainId: '0x2105' },
                ]),
            )
            await flush()
            expect(raisedOf(messages)).toHaveLength(1)
            expect((await store.get(ID))?.metadata.chainId).toBe('ethereum')

            await raisedOf(messages)[0]!.respond(signed)
            await flush()
            expect(resultOf(send.response!)).toBe('0xabc')
            const prompt = raisedOf(messages)[1]!
            expect(prompt.operation).toEqual({
                type: 'switch-network',
                networkId: 'mainnet',
            })

            await prompt.respond({ type: 'switch-network' })
            await flush()
            expect(resultOf(switched.response!)).toBeNull()
            expect((await store.get(ID))?.metadata.chainId).toBe('base')
        })

        it('a request queued behind a switch is raised on the chain switched to', async () => {
            const { transport, messages, sign } = await connected()
            void transport.send(ORIGIN, 'wallet_switchEthereumChain', [
                { chainId: '0x2105' },
            ])
            sign()
            await flush()
            expect(raisedOf(messages)).toHaveLength(1)

            await raisedOf(messages)[0]!.respond({ type: 'switch-network' })
            await flush()
            expect(raisedOf(messages)[1]?.chainId).toBe('base')
        })

        it('declining a switch rejects the requests queued behind it', async () => {
            const { transport, messages, sign } = await connected()
            const switched = track(
                transport.send(ORIGIN, 'wallet_switchEthereumChain', [
                    { chainId: '0x2105' },
                ]),
            )
            const send = sign()
            await flush()

            await raisedOf(messages)[0]!.reject(new DappRequestRejectedError())
            await flush()

            expect(errorOf(switched.response!)?.code).toBe(
                EIP1193_ERROR_CODE.userRejected,
            )
            expect(errorOf(send.response!)?.code).toBe(
                EIP1193_ERROR_CODE.userRejected,
            )
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('a switch whose answer throws and is never declined still frees the queue', async () => {
            const { transport, messages, networks, sign } = await connected()
            const switched = track(
                transport.send(ORIGIN, 'wallet_switchEthereumChain', [
                    { chainId: '0x2105' },
                ]),
            )
            await flush()
            networks.base = 'sepolia'
            await expect(
                raisedOf(messages)[0]!.respond({ type: 'switch-network' }),
            ).rejects.toThrow()

            vi.advanceTimersByTime(1_000)
            await flush()
            expect(errorOf(switched.response!)?.code).toBe(
                EIP1193_ERROR_CODE.internal,
            )

            sign()
            await flush()
            expect(raisedOf(messages)).toHaveLength(2)
        })

        it('a switch already satisfied by the one ahead of it answers without a prompt', async () => {
            const { transport, messages } = await connected()
            const toBase = () =>
                track(
                    transport.send(ORIGIN, 'wallet_switchEthereumChain', [
                        { chainId: '0x2105' },
                    ]),
                )
            toBase()
            const second = toBase()
            await flush()

            await raisedOf(messages)[0]!.respond({ type: 'switch-network' })
            await flush()
            expect(resultOf(second.response!)).toBeNull()
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('requests from different sites are raised independently', async () => {
            const { messages, sign } = await connected([
                siteOn(ORIGIN),
                siteOn(ORIGIN_B),
            ])
            sign(ORIGIN)
            sign(ORIGIN_B)
            await flush()
            expect(
                raisedOf(messages).map(({ verifiedOrigin }) => verifiedOrigin),
            ).toEqual([ORIGIN, ORIGIN_B])
        })

        it('a fourth pending request from one site is refused with -32005', async () => {
            const { messages, sign } = await connected()
            const pending = [sign(), sign(), sign()]
            const fourth = sign()
            await flush()
            expect(errorOf(fourth.response!)).toEqual({
                code: EIP1193_ERROR_CODE.limitExceeded,
                message: 'Too many requests are already pending for this site',
            })
            expect(pending.every(({ response }) => !response)).toBe(true)
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('rejecting the request on screen rejects the queued ones with 4001', async () => {
            const { messages, sign } = await connected()
            const all = [sign(), sign(), sign()]
            await flush()

            await raisedOf(messages)[0]!.reject(new DappRequestRejectedError())
            await flush()

            expect(all.map(({ response }) => errorOf(response!)?.code)).toEqual(
                [4001, 4001, 4001],
            )
            expect(raisedOf(messages)).toHaveLength(1)

            sign()
            await flush()
            expect(raisedOf(messages)).toHaveLength(2)
        })

        // Only the user's own decline speaks for the site's backlog; a failed
        // build or a revoked grant in the approval window does not.
        it('a wallet-side failure of the head answers -32603 and advances the queue', async () => {
            const { messages, sign } = await connected()
            const head = sign()
            const queued = sign()
            await flush()

            await raisedOf(messages)[0]!.reject(new Error('Request failed'))
            await flush()

            expect(errorOf(head.response!)).toEqual({
                code: EIP1193_ERROR_CODE.internal,
                message: expect.any(String),
            })
            expect(queued.response).toBeUndefined()
            expect(raisedOf(messages)).toHaveLength(2)
        })

        it('a wallet-side failure with a kind answers its mapped code and advances the queue', async () => {
            const { messages, sign } = await connected()
            const head = sign()
            const queued = sign()
            await flush()

            await raisedOf(messages)[0]!.reject(
                Object.assign(new Error('Request failed'), {
                    failure: 'unauthorized-account',
                }),
            )
            await flush()

            expect(errorOf(head.response!)?.code).toBe(
                EIP_1193_CODE['unauthorized-account'],
            )
            expect(queued.response).toBeUndefined()
            expect(raisedOf(messages)).toHaveLength(2)
        })

        // Only the user's own decline answers 4001.
        it('a queued request expires with -32603 after requestTtlMs from arrival', async () => {
            const { messages, sign } = await connected()
            const head = sign()
            const queued = sign()
            await flush()

            vi.advanceTimersByTime(1_000)
            await flush()

            expect(errorOf(queued.response!)).toEqual({
                code: EIP1193_ERROR_CODE.internal,
                message: 'The wallet did not answer in time',
            })
            expect(head.response).toBeUndefined()
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('a request that reaches the screen with its time nearly gone stays until answered', async () => {
            const { messages, sign } = await connected()
            sign()
            vi.advanceTimersByTime(400)
            const queued = sign()
            await flush()
            vi.advanceTimersByTime(500)
            await raisedOf(messages)[0]!.respond(signed)
            await flush()
            expect(raisedOf(messages)).toHaveLength(2)

            vi.advanceTimersByTime(5_000)
            await flush()
            expect(queued.response).toBeUndefined()

            await raisedOf(messages)[1]!.respond(signed)
            await flush()
            expect(resultOf(queued.response!)).toBe('0xabc')
        })

        it('the queue advances when the page is gone', async () => {
            const { transport, messages, sign } = await connected()
            sign()
            sign()
            await flush()
            transport.setReachable(ORIGIN, false)

            await raisedOf(messages)[0]!.respond(signed)
            await flush()

            expect(raisedOf(messages)).toHaveLength(2)
        })

        it('revoking the site answers its queued requests with 4100', async () => {
            const { registry, messages, sign } = await connected()
            const all = [sign(), sign(), sign()]
            await flush()

            await registry.disconnect(ID)
            await flush()

            expect(all.map(({ response }) => errorOf(response!)?.code)).toEqual(
                [
                    EIP1193_ERROR_CODE.unauthorized,
                    EIP1193_ERROR_CODE.unauthorized,
                    EIP1193_ERROR_CODE.unauthorized,
                ],
            )
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('revoking the site answers the request on screen and frees the queue for a reconnect', async () => {
            const { registry, store, messages, sign } = await connected()
            const head = sign()
            await flush()

            await registry.disconnect(ID)
            await flush()

            expect(errorOf(head.response!)).toEqual({
                code: EIP1193_ERROR_CODE.unauthorized,
                message: 'The site was disconnected',
            })
            await store.upsert(siteOn(ORIGIN))
            sign()
            await flush()
            expect(raisedOf(messages)).toHaveLength(2)
        })

        it('an answer that cannot be encoded answers -32603 and advances the queue', async () => {
            const { messages, sign } = await connected()
            const adapter = dappRequestChainAdapters.get('ethereum')
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register({
                ...adapter,
                walletConnect: {
                    ...adapter.walletConnect,
                    toWireResult: () => {
                        throw new Error('bad result')
                    },
                },
            })
            const head = sign()
            sign()
            await flush()

            await raisedOf(messages)[0]!.respond(signed)
            await flush()

            expect(errorOf(head.response!)?.code).toBe(
                EIP1193_ERROR_CODE.internal,
            )
            expect(raisedOf(messages)).toHaveLength(2)
        })

        it('queues only the methods a served chain lists as signing', async () => {
            const { transport, messages } = await connected()
            const adapter = dappRequestChainAdapters.get('ethereum')
            const v2 = adapter.walletConnect.v2!
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register({
                ...adapter,
                walletConnect: {
                    ...adapter.walletConnect,
                    v2: {
                        ...v2,
                        signingMethods: ['eth_signTypedData_v4'],
                    },
                },
            })
            const unlisted = transport.send(ORIGIN, 'personal_sign', [])
            void transport.send(ORIGIN, 'eth_signTypedData_v4', [])
            await flush()

            expect(errorOf(await unlisted)?.code).toBe(
                EIP1193_ERROR_CODE.unsupportedMethod,
            )
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('a queued request is raised with the connection as it is when raised', async () => {
            const context = await connected([siteOn(ORIGIN, [ADDR_X, ADDR_Y])])
            const { accounts, messages, sign } = context
            const adapter = dappRequestChainAdapters.get('ethereum')
            const seen: string[][] = []
            dappRequestChainAdapters.reset()
            dappRequestChainAdapters.register({
                ...adapter,
                sendTransaction: {
                    build: () => Promise.reject(new Error('unused')),
                    validate: (params, authorized) => {
                        seen.push([...authorized])
                        const { from } = params as { from: string }
                        return authorized.includes(from)
                            ? { ok: true, request: params }
                            : {
                                  ok: false,
                                  failure: 'unauthorized-account',
                                  message: 'Not an account of this site',
                              }
                    },
                },
            })
            sign(ORIGIN, ADDR_X)
            const fromDropped = sign(ORIGIN, ADDR_Y)
            await flush()

            accounts.ethereum = [ADDR_X]
            await raisedOf(messages)[0]!.respond(signed)
            await flush()

            expect(seen).toEqual([[ADDR_X, ADDR_Y], [ADDR_X]])
            expect(errorOf(fromDropped.response!)?.code).toBe(
                EIP1193_ERROR_CODE.unauthorized,
            )
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('a queued request whose chain stopped being served is answered 4901 without being raised', async () => {
            const { networks, messages, sign } = await connected()
            sign()
            const queued = sign()
            await flush()

            networks.ethereum = 'holesky'
            await raisedOf(messages)[0]!.respond(signed)
            await flush()

            expect(errorOf(queued.response!)?.code).toBe(
                EIP1193_ERROR_CODE.chainDisconnected,
            )
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('a queued request whose connection is gone is answered 4100 without being raised', async () => {
            const { store, messages, sign } = await connected()
            sign()
            const queued = sign()
            await flush()

            await store.remove(ID)
            await raisedOf(messages)[0]!.respond(signed)
            await flush()

            expect(errorOf(queued.response!)?.code).toBe(
                EIP1193_ERROR_CODE.unauthorized,
            )
            expect(raisedOf(messages)).toHaveLength(1)
        })

        it('teardown answers every queued request with 4900 and withdraws the one on screen', async () => {
            const { handler, messages, sign } = await connected()
            const all = [sign(), sign()]
            await flush()
            const [head] = raisedOf(messages)

            await handler.teardown()
            await flush()

            expect(all.map(({ response }) => errorOf(response!)?.code)).toEqual(
                [
                    EIP1193_ERROR_CODE.disconnected,
                    EIP1193_ERROR_CODE.disconnected,
                ],
            )
            expect(
                messages.filter(({ kind }) => kind === 'request-expired'),
            ).toEqual([
                expect.objectContaining({
                    correlationId: head!.correlationId,
                }),
            ])
        })

        it('a request on screen whose answer is lost frees the queue after approvalTtlMs', async () => {
            const { messages, sign } = await connected()
            const lost = sign()
            await flush()

            vi.advanceTimersByTime(60_000)
            await flush()
            expect(errorOf(lost.response!)?.code).toBe(
                EIP1193_ERROR_CODE.internal,
            )

            sign()
            await flush()
            expect(raisedOf(messages)).toHaveLength(2)
        })
    })

    describe('disconnect', () => {
        it('removes the record and tells every tab of the site it holds no accounts', async () => {
            const { transport, registry, store, messages } = setup([
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            await registry.disconnect(ID)
            expect(await store.get(ID)).toBeUndefined()
            expect(notificationsOf(transport, 'accountsChanged')).toEqual([
                { origin: ORIGIN, params: [] },
            ])
            expect(messages).toContainEqual({
                kind: 'connection-closed',
                connectionId: ID,
            })
        })
    })

    describe('notify', () => {
        it('reports the site’s accounts when an approved one on its chain changes', async () => {
            const { transport, handler, registry, accounts } = setup([
                connectedOn('ethereum', [ADDR_X, ADDR_Y]),
            ])
            await registry.initialize()
            accounts.ethereum = [ADDR_X]
            await handler.notify?.(ID, {
                type: 'accounts-changed',
                chainId: 'ethereum',
                accounts: [ADDR_X],
                changed: [ADDR_Y],
            })
            expect(notificationsOf(transport, 'accountsChanged')).toEqual([
                { origin: ORIGIN, params: [ADDR_X] },
            ])
        })

        it('ignores account changes on another chain or outside the grant', async () => {
            const { transport, handler, registry } = setup([
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            await handler.notify?.(ID, {
                type: 'accounts-changed',
                chainId: 'base',
                accounts: [],
                changed: [ADDR_X],
            })
            await handler.notify?.(ID, {
                type: 'accounts-changed',
                chainId: 'ethereum',
                accounts: [ADDR_X],
                changed: [ADDR_GONE],
            })
            expect(transport.notifications).toHaveLength(0)
        })

        it('reports chainChanged when the wallet’s network for the site’s chain moves', async () => {
            const { transport, handler, registry } = setup([
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            await handler.notify?.(ID, {
                type: 'network-changed',
                scope: { chainId: 'ethereum', networkId: 'sepolia' },
            })
            await handler.notify?.(ID, {
                type: 'network-changed',
                scope: { chainId: 'base', networkId: 'mainnet' },
            })
            expect(notificationsOf(transport, 'chainChanged')).toEqual([
                { origin: ORIGIN, params: '0xaa36a7' },
            ])
        })
    })

    describe('descriptors', () => {
        it('matches only the site’s chain and lists the granted methods', () => {
            const { handler } = setup()
            const connection = connectedOn('base')
            expect(
                handler.matchesChainScope(connection, {
                    chainId: 'base',
                    networkId: 'mainnet',
                }),
            ).toBe(true)
            expect(
                handler.matchesChainScope(connection, {
                    chainId: 'ethereum',
                    networkId: 'mainnet',
                }),
            ).toBe(false)
            expect(handler.methodsFor(connection)).toEqual([
                ...EIP1193_PERMISSION_METHODS,
            ])
        })

        it('restores only its own records', async () => {
            const algorand: Connection = {
                ...connectedOn('ethereum'),
                id: ORIGIN,
                kind: DAPP_KIND,
            }
            const { handler, registry } = setup([
                algorand,
                connectedOn('ethereum'),
            ])
            await registry.initialize()
            expect((await handler.restore()).map(({ id }) => id)).toEqual([ID])
        })
    })
})
