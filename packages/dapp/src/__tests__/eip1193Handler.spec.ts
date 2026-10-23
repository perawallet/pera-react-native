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
    createConnectionRegistry,
    dappRequestChainAdapters,
    DappRequestRejectedError,
    type ConnectionProposal,
    type DappRequestChainAdapter,
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
        toWireResult: () => null,
    },
    validateTransactionPayload: () => ({ ok: false, message: 'unused' }),
    useEnqueueTransactionSigning: () => async () => null,
})

type SetupOptions = {
    networks?: Partial<Record<ChainId, NetworkId>>
    disabled?: ChainId[]
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
        now: () => 1_000_000,
        proposalTtlMs: 1_000,
        requestTtlMs: 1_000,
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
            expect(
                resultOf(await transport.send(ORIGIN, 'eth_chainId')),
            ).toBe('0x1')
        })

        it('skips a chain whose dApp connections are switched off', async () => {
            const { transport, registry } = setup([], {
                disabled: ['ethereum'],
            })
            await registry.initialize()
            expect(
                resultOf(await transport.send(ORIGIN, 'eth_chainId')),
            ).toBe('0x2105')
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
            expect(
                resultOf(await transport.send(ORIGIN, 'eth_chainId')),
            ).toBe('0xaa36a7')
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
            expect(
                notificationsOf(transport, 'accountsChanged'),
            ).toEqual([{ origin: ORIGIN, params: [ADDR_Y] }])
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

        it('asks again on the site’s chain when none of its accounts can sign there', async () => {
            const { transport, registry, proposals } = setup([
                connectedOn('base', [ADDR_Y]),
            ])
            await registry.initialize()
            void transport.send(ORIGIN, 'eth_requestAccounts')
            await flush()
            expect(proposals[0].requested.chains).toEqual(['base'])
        })

        it('keeps the same site’s window.pera record apart', async () => {
            const algorand: Connection = {
                ...connectedOn('ethereum'),
                id: ORIGIN,
                kind: DAPP_KIND,
                metadata: undefined,
                origin: undefined,
            }
            const { transport, registry, proposals, store } = setup([
                algorand,
            ])
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
            expect(
                errorOf(await switchTo(transport, '0xaa36a7'))?.code,
            ).toBe(EIP1193_ERROR_CODE.unrecognizedChain)
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

        it('answers unsupported for any other method', async () => {
            const { transport, registry } = setup([connectedOn('ethereum')])
            await registry.initialize()
            expect(
                errorOf(await transport.send(ORIGIN, 'eth_sendTransaction'))
                    ?.code,
            ).toBe(EIP1193_ERROR_CODE.unsupportedMethod)
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
