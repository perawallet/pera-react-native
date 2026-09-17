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
import { Networks } from '@perawallet/wallet-core-config'
import {
    createConnectionRegistry,
    type ConnectionProposal,
    type InboundMessage,
} from '@perawallet/wallet-core-connections'
import { memoryStore } from '@perawallet/wallet-core-connections/testing'
import type { Connection } from '@perawallet/wallet-extension-connections'
import { JsonRpcErrorCode, type JsonRpcResponse } from '../codec'
import { createDappConnectionHandler } from '../handler'
import { DAPP_KIND, DAPP_METHODS, DAPP_NOTIFICATIONS } from '../protocol'
import { FakeDappTransport } from './fake-transport'

const ORIGIN = 'https://app.example'
const ADDR_A = 'A'.repeat(58)
const ADDR_B = 'B'.repeat(58)
// Captured before `vi.useFakeTimers()` installs its own: a macrotask boundary
// that drains the handler's await chain without advancing the clock the expiry
// cases are steering.
const realSetTimeout = globalThis.setTimeout
const flush = (): Promise<void> =>
    new Promise(resolve => realSetTimeout(resolve, 0))

const errorOf = (response: JsonRpcResponse) =>
    'error' in response ? response.error : undefined
const resultOf = (response: JsonRpcResponse) =>
    'result' in response ? response.result : undefined

const setup = (
    seed: Connection[] = [],
    overrides: {
        network?: (typeof Networks)[keyof typeof Networks]
        customGenesisHash?: string
    } = {},
) => {
    const transport = new FakeDappTransport()
    const store = memoryStore(seed)
    let now = 1_000_000
    const handler = createDappConnectionHandler({
        transport,
        getNetwork: () => overrides.network ?? Networks.mainnet,
        getCustomNetworkGenesisHash: () => overrides.customGenesisHash,
        getAccounts: () => [
            { address: ADDR_A, name: 'Main' },
            { address: ADDR_B, name: 'Savings' },
        ],
        now: () => now,
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
    }
}

const connected = (): Connection => ({
    id: ORIGIN,
    kind: DAPP_KIND,
    name: 'Example',
    peer: { name: 'Example', url: ORIGIN },
    accounts: [ADDR_A],
    status: 'active',
    createdAt: 1,
    lastActiveAt: 1,
})

describe('DappConnectionHandler', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    describe('connect', () => {
        it('proposes a connection with the verified origin as peer.url and requesterOrigin, then answers the page on approve', async () => {
            const { transport, registry, proposals, store } = setup()
            await registry.initialize()
            const pending = transport.send(ORIGIN, 'connect', {
                name: 'Example dApp',
                icons: [
                    'https://app.example/icon.png',
                    'https://cdn.other/x.png',
                ],
            })
            await flush()
            expect(proposals).toHaveLength(1)
            const proposal = proposals[0]
            expect(proposal.kind).toBe(DAPP_KIND)
            expect(proposal.peer).toEqual({
                name: 'Example dApp',
                url: ORIGIN,
                icons: ['https://app.example/icon.png'],
            })
            expect(proposal.requesterOrigin).toBe(ORIGIN)
            expect(proposal.requested).toEqual({
                networks: [Networks.mainnet],
                methods: [...DAPP_METHODS],
            })
            expect(proposal.pairingId).toBeUndefined()

            const connection = await proposal.approve([ADDR_A])
            expect(connection.id).toBe(ORIGIN)
            expect(connection.origin).toBeUndefined()
            expect((await store.get(ORIGIN))?.accounts).toEqual([ADDR_A])
            expect(resultOf(await pending)).toEqual({
                accounts: [{ address: ADDR_A, name: 'Main' }],
                network: Networks.mainnet,
            })
        })

        it('falls back to the host name and the tab favicon when the page supplies neither', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            void transport.send(ORIGIN, 'connect', undefined, {
                faviconUrl: 'https://app.example/favicon.ico',
            })
            await flush()
            expect(proposals[0].peer).toEqual({
                name: 'app.example',
                url: ORIGIN,
                icons: ['https://app.example/favicon.ico'],
            })
        })

        it('answers UserRejected when the proposal is rejected', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            const pending = transport.send(ORIGIN, 'connect')
            await flush()
            await proposals[0].reject('no thanks')
            expect(errorOf(await pending)?.code).toBe(
                JsonRpcErrorCode.UserRejected,
            )
        })

        it('answers RequestTimedOut when the proposal expires unanswered', async () => {
            const { transport, registry } = setup()
            await registry.initialize()
            const pending = transport.send(ORIGIN, 'connect')
            await flush()
            vi.advanceTimersByTime(1_001)
            expect(errorOf(await pending)?.code).toBe(
                JsonRpcErrorCode.RequestTimedOut,
            )
        })

        it('refuses to propose without user activation and opens no proposal', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'connect',
                undefined,
                {
                    hasUserActivation: false,
                },
            )
            expect(errorOf(response)?.code).toBe(JsonRpcErrorCode.Unauthorized)
            expect(proposals).toHaveLength(0)
        })

        it('answers an already-connected origin immediately with its accounts, no proposal, no activation needed', async () => {
            const { transport, registry, proposals, store } = setup([
                connected(),
            ])
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'connect',
                undefined,
                {
                    hasUserActivation: false,
                },
            )
            expect(resultOf(response)).toEqual({
                accounts: [{ address: ADDR_A, name: 'Main' }],
                network: Networks.mainnet,
            })
            expect(proposals).toHaveLength(0)
            expect((await store.get(ORIGIN))?.lastActiveAt).toBe(1_000_000)
        })

        it('rejects a second connect while one is pending for the origin', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            void transport.send(ORIGIN, 'connect')
            await flush()
            const second = await transport.send(ORIGIN, 'connect')
            expect(errorOf(second)?.code).toBe(JsonRpcErrorCode.InvalidRequest)
            expect(proposals).toHaveLength(1)
        })

        it('opens one proposal for two connect calls fired in the same task, and frees the slot once settled', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            // No flush between them: both suspend on the store read inside
            // handleConnect, which is the race the origin slot guards.
            const first = transport.send(ORIGIN, 'connect')
            const second = transport.send(ORIGIN, 'connect')
            await flush()

            expect(proposals).toHaveLength(1)
            expect(errorOf(await second)?.code).toBe(
                JsonRpcErrorCode.InvalidRequest,
            )

            await proposals[0].approve([ADDR_A])
            expect(resultOf(await first)).toEqual({
                accounts: [{ address: ADDR_A, name: 'Main' }],
                network: Networks.mainnet,
            })
            const later = await transport.send(ORIGIN, 'connect', undefined, {
                hasUserActivation: false,
            })
            expect(resultOf(later)).toEqual({
                accounts: [{ address: ADDR_A, name: 'Main' }],
                network: Networks.mainnet,
            })
        })

        it('answers Unauthorized, not NetworkNotSupported, when a gesture-free connect names a mismatching network', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'connect',
                { network: Networks.testnet },
                { hasUserActivation: false },
            )
            // The wrong-network message names the wallet's active network, so
            // the activation gate has to win: an unapproved page must learn
            // nothing about the wallet from a connect it never earned.
            expect(errorOf(response)?.code).toBe(JsonRpcErrorCode.Unauthorized)
            expect(errorOf(response)?.message).not.toContain(Networks.mainnet)
            expect(proposals).toHaveLength(0)
        })

        it('holds the origin slot until the approved record is stored', async () => {
            const { transport, registry, proposals, store } = setup()
            await registry.initialize()
            void transport.send(ORIGIN, 'connect')
            await flush()

            let releaseUpsert = (): void => {}
            const realUpsert = store.upsert.bind(store)
            vi.spyOn(store, 'upsert').mockImplementation(async connection => {
                await new Promise<void>(resolve => {
                    releaseUpsert = resolve
                })
                return realUpsert(connection)
            })
            const approved = proposals[0].approve([ADDR_A])
            await flush()

            // A second tab of the same origin while the upsert is in flight:
            // the slot is still claimed, so no second proposal opens.
            const second = await transport.send(ORIGIN, 'connect')
            expect(errorOf(second)?.code).toBe(JsonRpcErrorCode.InvalidRequest)
            expect(proposals).toHaveLength(1)

            releaseUpsert()
            await approved
        })

        it('fails with NetworkNotSupported when the page names a different network', async () => {
            const { transport, registry, proposals } = setup()
            await registry.initialize()
            const response = await transport.send(ORIGIN, 'connect', {
                network: Networks.testnet,
            })
            expect(errorOf(response)?.code).toBe(
                JsonRpcErrorCode.NetworkNotSupported,
            )
            expect(proposals).toHaveLength(0)
        })

        it('fails with NetworkNotSupported on a custom network with an unknown genesis hash', async () => {
            const { transport, registry } = setup([], {
                network: Networks.custom,
                customGenesisHash: 'unknown',
            })
            await registry.initialize()
            const response = await transport.send(ORIGIN, 'connect')
            expect(errorOf(response)?.code).toBe(
                JsonRpcErrorCode.NetworkNotSupported,
            )
        })
    })

    describe('signing', () => {
        it('refuses a sign request from an unconnected origin', async () => {
            const { transport, registry, messages } = setup()
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'requestTransactionSigning',
                { txns: [{ txn: 'AA==' }] },
            )
            expect(errorOf(response)?.code).toBe(JsonRpcErrorCode.Unauthorized)
            expect(messages).toHaveLength(0)
        })

        it('stamps the browser-verified origin on the request so the pipeline can origin-bind it', async () => {
            const { transport, registry, messages } = setup([connected()])
            await registry.initialize()
            void transport.send(ORIGIN, 'requestTransactionSigning', {
                txns: [{ txn: 'AA==' }],
            })
            await flush()
            const message = messages[0]
            if (message.kind !== 'request')
                throw new Error('expected a request')
            expect(message.verifiedOrigin).toBe(ORIGIN)
        })

        it('emits a sign-transactions request keyed by a handler-minted id and maps the result back', async () => {
            const { transport, registry, messages } = setup([connected()])
            await registry.initialize()
            const pending = transport.send(
                ORIGIN,
                'requestTransactionSigning',
                {
                    txns: [{ txn: 'AA==' }],
                    opts: { message: 'ignored on the wire' },
                },
                { id: 'page-chosen-id' },
            )
            await flush()
            const message = messages[0]
            if (message.kind !== 'request')
                throw new Error('expected a request')
            expect(message.correlationId).not.toBe('page-chosen-id')
            expect(message.connectionId).toBe(ORIGIN)
            expect(message.sourceType).toBe('injected')
            expect(message.authorizedAccounts).toEqual([ADDR_A])
            expect(message.operation).toEqual({
                type: 'sign-transactions',
                group: [{ txn: 'AA==' }],
            })
            await message.respond({
                type: 'sign-transactions',
                signed: ['c2ln', null],
            })
            const response = await pending
            expect(response.id).toBe('page-chosen-id')
            expect(resultOf(response)).toEqual(['c2ln', null])
        })

        it('maps a sign-data result to base64 signatures', async () => {
            const { transport, registry, messages } = setup([connected()])
            await registry.initialize()
            const pending = transport.send(ORIGIN, 'requestDataSigning', {
                data: [{ signer: ADDR_A, data: 'aGVsbG8=', message: 'hi' }],
            })
            await flush()
            const message = messages[0]
            if (message.kind !== 'request')
                throw new Error('expected a request')
            expect(message.operation.type).toBe('sign-data')
            await message.respond({
                type: 'sign-data',
                signatures: [new Uint8Array([1, 2, 3])],
            })
            expect(resultOf(await pending)).toEqual(['AQID'])
        })

        it('maps a user rejection to UserRejected and other failures to a sanitized InternalError', async () => {
            const { transport, registry, messages } = setup([connected()])
            await registry.initialize()
            const first = transport.send(ORIGIN, 'requestTransactionSigning', {
                txns: [{ txn: 'AA==' }],
            })
            await flush()
            const cancelled = Object.assign(new Error('User cancelled'), {
                name: 'UserCancelledError',
            })
            const m1 = messages[0]
            if (m1.kind !== 'request') throw new Error('expected a request')
            await m1.reject(cancelled)
            expect(errorOf(await first)?.code).toBe(
                JsonRpcErrorCode.UserRejected,
            )

            const second = transport.send(ORIGIN, 'requestTransactionSigning', {
                txns: [{ txn: 'AA==' }],
            })
            await flush()
            const m2 = messages[1]
            if (m2.kind !== 'request') throw new Error('expected a request')
            await m2.reject(new Error(`secret address ${ADDR_B}`))
            const error = errorOf(await second)
            expect(error?.code).toBe(JsonRpcErrorCode.InternalError)
            expect(error?.message).not.toContain(ADDR_B)
        })

        it('answers InvalidParams when txns is missing', async () => {
            const { transport, registry } = setup([connected()])
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'requestTransactionSigning',
                {},
            )
            expect(errorOf(response)?.code).toBe(JsonRpcErrorCode.InvalidParams)
        })

        it('maps the registry rejecting a malformed payload to InvalidParams, before any request reaches a subscriber', async () => {
            const { transport, registry, messages } = setup([connected()])
            await registry.initialize()
            const response = await transport.send(
                ORIGIN,
                'requestTransactionSigning',
                { txns: 'nope' },
            )
            expect(errorOf(response)?.code).toBe(JsonRpcErrorCode.InvalidParams)
            expect(messages.some(m => m.kind === 'request')).toBe(false)
        })

        it('expires an unanswered request: page gets RequestTimedOut and the registry hears request-expired', async () => {
            const { transport, registry, messages } = setup([connected()])
            await registry.initialize()
            const pending = transport.send(
                ORIGIN,
                'requestTransactionSigning',
                { txns: [{ txn: 'AA==' }] },
            )
            await flush()
            vi.advanceTimersByTime(1_001)
            expect(errorOf(await pending)?.code).toBe(
                JsonRpcErrorCode.RequestTimedOut,
            )
            expect(
                messages.some(
                    m =>
                        m.kind === 'request-expired' &&
                        m.connectionId === ORIGIN,
                ),
            ).toBe(true)
        })
    })

    describe('getAddresses / disconnect / unknown', () => {
        it('returns the approved accounts with names, or Unauthorized when not connected', async () => {
            const { transport, registry } = setup([connected()])
            await registry.initialize()
            expect(
                resultOf(await transport.send(ORIGIN, 'getAddresses')),
            ).toEqual([{ address: ADDR_A, name: 'Main' }])
            expect(
                errorOf(
                    await transport.send(
                        'https://other.example',
                        'getAddresses',
                    ),
                )?.code,
            ).toBe(JsonRpcErrorCode.Unauthorized)
        })

        it('drops an approved address the wallet no longer lists as signing-capable', async () => {
            const stale: Connection = {
                ...connected(),
                accounts: [ADDR_A, 'C'.repeat(58)],
            }
            const { transport, registry } = setup([stale])
            await registry.initialize()
            expect(
                resultOf(await transport.send(ORIGIN, 'getAddresses')),
            ).toEqual([{ address: ADDR_A, name: 'Main' }])
        })

        it('disconnect from the page removes the record and notifies the origin', async () => {
            const { transport, registry, store } = setup([connected()])
            await registry.initialize()
            const response = await transport.send(ORIGIN, 'disconnect')
            expect(resultOf(response)).toBeNull()
            expect(await store.get(ORIGIN)).toBeUndefined()
            expect(transport.notifications).toEqual([
                {
                    origin: ORIGIN,
                    notification: {
                        jsonrpc: '2.0',
                        method: DAPP_NOTIFICATIONS.disconnect,
                        params: {},
                    },
                },
            ])
        })

        it('disconnect from the wallet (registry) notifies the origin too', async () => {
            const { transport, registry } = setup([connected()])
            await registry.initialize()
            await registry.disconnect(ORIGIN)
            expect(
                transport.notifications.map(n => n.notification.method),
            ).toEqual([DAPP_NOTIFICATIONS.disconnect])
        })

        it('forwards wallet notices as page notifications', async () => {
            const { transport, registry, handler } = setup([connected()])
            await registry.initialize()
            await handler.notify?.(ORIGIN, {
                type: 'network-changed',
                network: Networks.testnet,
            })
            await handler.notify?.(ORIGIN, {
                type: 'accounts-changed',
                accounts: [ADDR_B],
            })
            expect(transport.notifications.map(n => n.notification)).toEqual([
                {
                    jsonrpc: '2.0',
                    method: DAPP_NOTIFICATIONS.networkChanged,
                    params: { network: Networks.testnet },
                },
                {
                    jsonrpc: '2.0',
                    method: DAPP_NOTIFICATIONS.accountsChanged,
                    params: { accounts: [ADDR_B] },
                },
            ])
        })

        it('answers MethodNotFound for anything outside the method set', async () => {
            const { transport, registry } = setup()
            await registry.initialize()
            expect(
                errorOf(await transport.send(ORIGIN, 'pushWebView'))?.code,
            ).toBe(JsonRpcErrorCode.MethodNotFound)
        })

        it('stops listening on teardown', async () => {
            const { transport, registry } = setup()
            await registry.initialize()
            await registry.teardown()
            expect(transport.listener).toBeUndefined()
        })
    })
})
