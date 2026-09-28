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

import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest'

const queryClientMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    critical: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: queryClientMock,
    logger: loggerMock,
    Networks: { mainnet: 'mainnet', testnet: 'testnet' },
    decodeFromBase64: (base64: string) =>
        new Uint8Array(Buffer.from(base64, 'base64')),
}))
// The blockchain barrel pulls native deps that don't load under node; a
// byte-labelled stand-in keeps the address maths observable.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: (bytes: Uint8Array) => `ADDR(${bytes[0]})`,
}))

import { verifyNfdAddress } from '../verifyNfdAddress'

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')
const key = (fill: number) => Buffer.alloc(32, fill)
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const registry = (status: number, body?: unknown) =>
    fetchMock.mockResolvedValue({
        status,
        ok: status >= 200 && status < 300,
        json: async () => body,
    })

const application = (name: string, ownerFill: number) => ({
    params: {
        'global-state': [
            { key: b64('i.name'), value: { type: 1, bytes: b64(name) } },
            {
                key: b64('i.owner.a'),
                value: { type: 1, bytes: key(ownerFill).toString('base64') },
            },
        ],
    },
})

const algod = (responses: Record<string, unknown>) =>
    queryClientMock.mockImplementation(
        async ({
            url,
            params,
        }: {
            url: string
            params?: { name?: string }
        }) => {
            const route = params?.name ? `${url}?name=${params.name}` : url
            if (!(route in responses)) throw new Error(`unexpected ${route}`)
            return { data: responses[route], status: 200, statusText: 'OK' }
        },
    )

const verify = (address: string, name = 'alice.algo') =>
    verifyNfdAddress({
        name,
        address,
        scope: { chainId: 'algorand', networkId: 'mainnet' },
    })

describe('verifyNfdAddress', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
        fetchMock.mockReset()
        loggerMock.warn.mockReset()
    })
    afterAll(() => vi.unstubAllGlobals())

    test('verifies the on-chain owner', async () => {
        registry(200, { appID: 7 })
        algod({
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(1)')).toBe('verified')
        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.nf.domains/nfd/alice.algo?view=brief',
            expect.anything(),
        )
    })

    test('verifies an address from the verified-addresses box, reading only those boxes', async () => {
        registry(200, { appID: 7 })
        const verifiedBox = b64('v.caAlgo.0.as')
        algod({
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': {
                boxes: [{ name: b64('v.avatar') }, { name: verifiedBox }],
            },
            [`/v2/applications/7/box?name=b64:${verifiedBox}`]: {
                value: Buffer.concat([key(2), key(3)]).toString('base64'),
            },
        })

        expect(await verify('ADDR(3)')).toBe('verified')
        expect(queryClientMock).not.toHaveBeenCalledWith(
            expect.objectContaining({
                params: { name: `b64:${b64('v.avatar')}` },
            }),
        )
    })

    test('rejects an address the contract does not list', async () => {
        registry(200, { appID: 7 })
        algod({
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(9)')).toBe('mismatch')
    })

    test('rejects an application whose on-chain name is not the one typed, even when the owner matches', async () => {
        registry(200, { appID: 7 })
        algod({
            '/v2/applications/7': application('mallory.algo', 1),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(1)')).toBe('mismatch')
    })

    test('rejects a name the registry does not know or will not parse', async () => {
        registry(404)
        expect(await verify('ADDR(1)')).toBe('mismatch')

        registry(400)
        expect(await verify('ADDR(1)')).toBe('mismatch')
        expect(queryClientMock).not.toHaveBeenCalled()
    })

    test('normalizes the name before asking the registry and comparing on chain', async () => {
        registry(200, { appID: 7 })
        algod({
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(1)', 'AliCe.ALGO')).toBe('verified')
        expect(fetchMock.mock.calls[0]?.[0]).toContain('/nfd/alice.algo?')
    })

    test('is unavailable, not a verdict, when the registry or algod fail', async () => {
        registry(503)
        expect(await verify('ADDR(1)')).toBe('unavailable')

        registry(200, { appID: 7 })
        queryClientMock.mockRejectedValue(new Error('algod down'))
        expect(await verify('ADDR(1)')).toBe('unavailable')
        expect(loggerMock.warn).toHaveBeenCalled()
    })

    test('is unavailable for a network id Algorand never issued', async () => {
        const result = await verifyNfdAddress({
            name: 'alice.algo',
            address: 'ADDR(1)',
            scope: { chainId: 'algorand', networkId: 'not-a-network' },
        })

        expect(result).toBe('unavailable')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('lets an abort propagate so callers can ignore a stale answer', async () => {
        const abort = new Error('aborted')
        abort.name = 'AbortError'
        fetchMock.mockRejectedValue(abort)

        await expect(verify('ADDR(1)')).rejects.toBe(abort)
    })
})
