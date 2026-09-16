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

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JsonRpcErrorCode } from '@perawallet/wallet-extension-platform-chrome'
import { CHANNEL_HANDSHAKE_EVENT, CHANNEL_RELAY_READY_EVENT } from '../channel'
import { installMainProvider } from '../inject-main'

type Sent = {
    id: string
    request: { id: string; method: string; params?: unknown }
}

const stubRelay = (answer: (sent: Sent) => unknown | undefined) => {
    const sent: Sent[] = []
    const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail as Sent
        sent.push(detail)
        const response = answer(detail)
        if (response === undefined) return
        window.dispatchEvent(
            new CustomEvent(installMainProvider.__responseEventName, {
                detail: { id: detail.id, response },
            }),
        )
    }
    window.addEventListener(installMainProvider.__requestEventName, handler)
    return {
        sent,
        detach: () =>
            window.removeEventListener(
                installMainProvider.__requestEventName,
                handler,
            ),
        notify: (notification: unknown) =>
            window.dispatchEvent(
                new CustomEvent(installMainProvider.__responseEventName, {
                    detail: { notification },
                }),
            ),
    }
}

describe('window.pera provider', () => {
    beforeEach(() => {
        installMainProvider()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('exposes a frozen provider with the versioned method set', () => {
        expect(window.pera.version).toBe('1')
        expect(Object.isFrozen(window.pera)).toBe(true)
        for (const method of [
            'connect',
            'disconnect',
            'getAddresses',
            'signTransactions',
            'signData',
            'on',
        ] as const) {
            expect(typeof window.pera[method]).toBe('function')
        }
    })

    it('connect sends a JSON-RPC connect request and resolves with the result', async () => {
        const relay = stubRelay(sent => ({
            jsonrpc: '2.0',
            id: sent.request.id,
            result: { accounts: [], network: 'mainnet' },
        }))
        const result = await window.pera.connect({ name: 'Test' })
        expect(result).toEqual({ accounts: [], network: 'mainnet' })
        expect(relay.sent[0].request).toMatchObject({
            jsonrpc: '2.0',
            method: 'connect',
            params: { name: 'Test' },
        })
        expect(relay.sent[0].id).toBe(relay.sent[0].request.id)
        relay.detach()
    })

    it('coalesces concurrent connect() calls into a single request', async () => {
        const relay = stubRelay(sent => ({
            jsonrpc: '2.0',
            id: sent.request.id,
            result: {
                accounts: [{ address: 'A', name: 'n' }],
                network: 'mainnet',
            },
        }))
        const [first, second] = await Promise.all([
            window.pera.connect(),
            window.pera.connect(),
        ])
        expect(relay.sent).toHaveLength(1)
        expect(first).toBe(second)

        // The slot clears once settled, so a later connect() is a fresh request.
        await window.pera.connect()
        expect(relay.sent).toHaveLength(2)
        relay.detach()
    })

    it('releases the coalesced connect slot when the shared call rejects', async () => {
        const refused = stubRelay(sent => ({
            jsonrpc: '2.0',
            id: sent.request.id,
            error: { code: JsonRpcErrorCode.UserRejected, message: 'no' },
        }))
        await expect(
            Promise.all([window.pera.connect(), window.pera.connect()]),
        ).rejects.toMatchObject({ code: JsonRpcErrorCode.UserRejected })
        expect(refused.sent).toHaveLength(1)
        refused.detach()

        // A rejection must not wedge the slot: the dApp retries after the user
        // declines, and every later connect() would otherwise get the dead
        // promise back forever.
        const accepted = stubRelay(sent => ({
            jsonrpc: '2.0',
            id: sent.request.id,
            result: { accounts: [], network: 'mainnet' },
        }))
        await expect(window.pera.connect()).resolves.toEqual({
            accounts: [],
            network: 'mainnet',
        })
        expect(accepted.sent).toHaveLength(1)
        accepted.detach()
    })

    it('signTransactions maps to requestTransactionSigning with { txns, opts }', async () => {
        const relay = stubRelay(sent => ({
            jsonrpc: '2.0',
            id: sent.request.id,
            result: ['c2ln'],
        }))
        await expect(
            window.pera.signTransactions([{ txn: 'AA==' }], { message: 'm' }),
        ).resolves.toEqual(['c2ln'])
        expect(relay.sent[0].request).toMatchObject({
            method: 'requestTransactionSigning',
            params: { txns: [{ txn: 'AA==' }], opts: { message: 'm' } },
        })
        relay.detach()
    })

    it('signData maps to requestDataSigning with the payload as params', async () => {
        const relay = stubRelay(sent => ({
            jsonrpc: '2.0',
            id: sent.request.id,
            result: ['AQID'],
        }))
        const payload = { data: [{ signer: 'A', data: 'aGk=' }] }
        await expect(window.pera.signData(payload)).resolves.toEqual(['AQID'])
        expect(relay.sent[0].request).toMatchObject({
            method: 'requestDataSigning',
            params: payload,
        })
        relay.detach()
    })

    it('rejects with a PeraProviderError carrying the JSON-RPC code and message', async () => {
        const relay = stubRelay(sent => ({
            jsonrpc: '2.0',
            id: sent.request.id,
            error: { code: JsonRpcErrorCode.UserRejected, message: 'no' },
        }))
        await expect(window.pera.connect()).rejects.toMatchObject({
            name: 'PeraProviderError',
            code: JsonRpcErrorCode.UserRejected,
            message: 'no',
        })
        relay.detach()
    })

    it('times out with RequestTimedOut when nothing answers', async () => {
        vi.useFakeTimers()
        const relay = stubRelay(() => undefined)
        const pending = window.pera.getAddresses()
        const outcome = pending.catch((e: { code: number }) => e.code)
        await vi.advanceTimersByTimeAsync(5 * 60_000 + 10_001)
        expect(await outcome).toBe(JsonRpcErrorCode.RequestTimedOut)
        relay.detach()
    })

    it('dispatches notifications to on() listeners and lets them unsubscribe', () => {
        const relay = stubRelay(() => undefined)
        const onDisconnect = vi.fn()
        const onNetwork = vi.fn()
        const off = window.pera.on('disconnect', onDisconnect)
        window.pera.on('networkChanged', onNetwork)
        relay.notify({
            jsonrpc: '2.0',
            method: 'networkChanged',
            params: { network: 'testnet' },
        })
        relay.notify({ jsonrpc: '2.0', method: 'disconnect', params: {} })
        expect(onNetwork).toHaveBeenCalledWith({ network: 'testnet' })
        expect(onDisconnect).toHaveBeenCalledTimes(1)
        off()
        relay.notify({ jsonrpc: '2.0', method: 'disconnect', params: {} })
        expect(onDisconnect).toHaveBeenCalledTimes(1)
        relay.detach()
    })

    it('keeps delivering a notification after a listener throws', () => {
        const relay = stubRelay(() => undefined)
        const thrower = vi.fn(() => {
            throw new Error('page listener blew up')
        })
        const next = vi.fn()
        const offThrower = window.pera.on('accountsChanged', thrower)
        const offNext = window.pera.on('accountsChanged', next)

        relay.notify({
            jsonrpc: '2.0',
            method: 'accountsChanged',
            params: { accounts: [] },
        })

        expect(thrower).toHaveBeenCalledTimes(1)
        expect(next).toHaveBeenCalledWith({ accounts: [] })
        offThrower()
        offNext()
        relay.detach()
    })

    it('ignores a response for an unknown id', () => {
        expect(() =>
            window.dispatchEvent(
                new CustomEvent(installMainProvider.__responseEventName, {
                    detail: {
                        id: 'nope',
                        response: { jsonrpc: '2.0', id: 'nope', result: 1 },
                    },
                }),
            ),
        ).not.toThrow()
    })

    it('dispatches the handshake on install and again when the relay signals ready', () => {
        const seen: unknown[] = []
        window.addEventListener(CHANNEL_HANDSHAKE_EVENT, e =>
            seen.push((e as CustomEvent).detail),
        )
        window.dispatchEvent(new CustomEvent(CHANNEL_RELAY_READY_EVENT))
        expect(seen).toEqual([
            {
                requestEventName: installMainProvider.__requestEventName,
                responseEventName: installMainProvider.__responseEventName,
            },
        ])
    })
})
