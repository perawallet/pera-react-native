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

import { createHash } from 'node:crypto'
import { describe, test, expect, vi, beforeEach } from 'vitest'

const fetchNodeJsonMock = vi.hoisted(() => vi.fn())
const loggerMock = vi.hoisted(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    critical: vi.fn(),
}))

vi.mock('../../blockchain/utils/nodeHttp', () => ({
    fetchNodeJson: fetchNodeJsonMock,
}))
vi.mock('@perawallet/wallet-core-shared', () => ({
    toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
    logger: loggerMock,
    decodeFromBase64: (base64: string) =>
        new Uint8Array(Buffer.from(base64, 'base64')),
    encodeToBase64: (bytes: Uint8Array) =>
        Buffer.from(bytes).toString('base64'),
}))
// The blockchain barrel pulls native deps that don't load under node; a
// byte-labelled stand-in keeps the address maths observable.
vi.mock('../../blockchain', () => ({
    encodeAlgorandAddress: (bytes: Uint8Array) => `ADDR(${bytes[0]})`,
}))

import { verifyNfdAddress } from '../verifyNfdAddress'

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')
const key = (fill: number) => Buffer.alloc(32, fill)
const registries = {
    mainnet: {
        id: 760937186,
        legacyAlice:
            'BXZV6QX6NWPCG2NEA7AYEEUD64FPR3F4C6RED35LMWVT4VGUVTPF4ZY6VY',
    },
    testnet: {
        id: 84366825,
        legacyAlice:
            'MJFIL6HXDW44NSJ6CGTNJLXNFEDA4G6YTD7BBFFJP73LN72UZ7TLQZBHXA',
    },
} as const
type Network = keyof typeof registries

const registryRoute = (name: string, network: Network) =>
    `/v2/applications/${registries[network].id}/box?name=b64:${createHash(
        'sha256',
    )
        .update(`name/${name}`)
        .digest('base64')}`

const registryBox = (appId: number) => {
    const value = Buffer.alloc(16)
    value.writeBigUInt64BE(99n, 0)
    value.writeBigUInt64BE(BigInt(appId), 8)
    return { value: value.toString('base64') }
}

const legacyRegistryRoute = (network: Network) =>
    `/v2/accounts/${registries[network].legacyAlice}/applications/${registries[network].id}`

const legacyRegistryState = (appId: number, network: Network) => {
    const value = Buffer.alloc(8)
    value.writeBigUInt64BE(BigInt(appId))
    return {
        'app-local-state': {
            id: registries[network].id,
            'key-value': [
                {
                    key: b64('i.appid'),
                    value: { type: 1, bytes: value.toString('base64') },
                },
            ],
        },
    }
}

const notFound = () =>
    Object.assign(new Error('box not found'), { status: 404 })

const application = (name: string, ownerFill: number, linked?: Buffer) => ({
    params: {
        'global-state': [
            { key: b64('i.name'), value: { type: 1, bytes: b64(name) } },
            {
                key: b64('i.owner.a'),
                value: { type: 1, bytes: key(ownerFill).toString('base64') },
            },
            ...(linked
                ? [
                      {
                          key: b64('v.caAlgo.0.as'),
                          value: { type: 1, bytes: linked.toString('base64') },
                      },
                  ]
                : []),
        ],
    },
})

const algod = (responses: Record<string, unknown>) =>
    fetchNodeJsonMock.mockImplementation(
        async (
            _scope: unknown,
            _backend: unknown,
            url: string,
            { params }: { params?: { name?: string } },
        ) => {
            const route = params?.name ? `${url}?name=${params.name}` : url
            if (!(route in responses)) throw notFound()
            const response = responses[route]
            if (response instanceof Error) throw response
            return response
        },
    )

const registered = (
    appId: number,
    name = 'alice.algo',
    network: Network = 'mainnet',
) => ({
    [registryRoute(name, network)]: registryBox(appId),
})

const verify = (
    address: string,
    name = 'alice.algo',
    networkId: Network = 'mainnet',
) =>
    verifyNfdAddress({
        name,
        address,
        scope: { chainId: 'algorand', networkId },
    })

describe('verifyNfdAddress', () => {
    beforeEach(() => {
        fetchNodeJsonMock.mockReset()
        loggerMock.warn.mockReset()
    })

    test('verifies the on-chain owner', async () => {
        algod({
            ...registered(7),
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(1)')).toBe('verified')
        expect(fetchNodeJsonMock).toHaveBeenCalledWith(
            { chainId: 'algorand', networkId: 'mainnet' },
            'algod',
            '/v2/applications/7',
            expect.anything(),
        )
    })

    test('verifies an address from the verified-addresses box, reading only those boxes', async () => {
        const verifiedBox = b64('v.caAlgo.0.as')
        algod({
            ...registered(7),
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': {
                boxes: [{ name: b64('v.avatar') }, { name: verifiedBox }],
            },
            [`/v2/applications/7/box?name=b64:${verifiedBox}`]: {
                value: Buffer.concat([key(2), key(3)]).toString('base64'),
            },
        })

        expect(await verify('ADDR(3)')).toBe('verified')
        expect(fetchNodeJsonMock).not.toHaveBeenCalledWith(
            expect.anything(),
            'algod',
            '/v2/applications/7/box',
            expect.objectContaining({
                params: { name: `b64:${b64('v.avatar')}` },
            }),
        )
    })

    test('rejects an address the contract does not list', async () => {
        algod({
            ...registered(7),
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(9)')).toBe('mismatch')
    })

    test('rejects an application whose on-chain name is not the one typed, even when the owner matches', async () => {
        algod({
            ...registered(7),
            '/v2/applications/7': application('mallory.algo', 1),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(1)')).toBe('mismatch')
    })

    test('rejects a name absent from both on-chain registry formats', async () => {
        algod({
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(1)')).toBe('mismatch')
        expect(fetchNodeJsonMock).toHaveBeenCalledTimes(2)
    })

    test.each(['mainnet', 'testnet'] as const)(
        'rejects a named application absent from the %s registry',
        async network => {
            const unrelated = application('alice.algo', 1)
            algod({
                ...registered(8, 'alice.algo', network),
                '/v2/applications/7': {
                    params: { ...unrelated.params, creator: 'OTHER_CREATOR' },
                },
                '/v2/applications/8': application('alice.algo', 2),
                '/v2/applications/8/boxes': { boxes: [] },
            })

            expect(await verify('ADDR(1)', 'alice.algo', network)).toBe(
                'mismatch',
            )
            expect(fetchNodeJsonMock).not.toHaveBeenCalledWith(
                expect.anything(),
                'algod',
                '/v2/applications/7',
                expect.anything(),
            )
        },
    )

    test.each(['mainnet', 'testnet'] as const)(
        'verifies a legacy name through the %s registry account when no box exists',
        async network => {
            algod({
                [legacyRegistryRoute(network)]: legacyRegistryState(7, network),
                '/v2/applications/7': application(
                    'alice.algo',
                    1,
                    Buffer.concat([key(2), key(0)]),
                ),
                '/v2/applications/7/boxes': { boxes: [] },
            })

            expect(await verify('ADDR(1)', 'alice.algo', network)).toBe(
                'verified',
            )
            expect(await verify('ADDR(2)', 'alice.algo', network)).toBe(
                'verified',
            )
            expect(await verify('ADDR(0)', 'alice.algo', network)).toBe(
                'mismatch',
            )
        },
    )

    test('verifies a legacy name from the verified-addresses box when its contract moved to boxes', async () => {
        const verifiedBox = b64('v.caAlgo.0.as')
        algod({
            [legacyRegistryRoute('mainnet')]: legacyRegistryState(7, 'mainnet'),
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': { boxes: [{ name: verifiedBox }] },
            [`/v2/applications/7/box?name=b64:${verifiedBox}`]: {
                value: key(4).toString('base64'),
            },
        })

        expect(await verify('ADDR(4)')).toBe('verified')
    })

    test('ignores legacy address state for a name that has migrated to boxes', async () => {
        algod({
            ...registered(7),
            '/v2/applications/7': application('alice.algo', 1, key(2)),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(2)')).toBe('mismatch')
    })

    test('normalizes the name before asking the registry and comparing on chain', async () => {
        algod({
            ...registered(7),
            '/v2/applications/7': application('alice.algo', 1),
            '/v2/applications/7/boxes': { boxes: [] },
        })

        expect(await verify('ADDR(1)', 'AliCe.ALGO')).toBe('verified')
    })

    test('is unavailable, not a verdict, when the registry or algod fail', async () => {
        algod({ ...registered(7), '/v2/applications/7': new Error('down') })
        expect(await verify('ADDR(1)')).toBe('unavailable')

        fetchNodeJsonMock.mockRejectedValue(new Error('algod down'))
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
        expect(fetchNodeJsonMock).not.toHaveBeenCalled()
    })

    test('lets an abort propagate so callers can ignore a stale answer', async () => {
        const abort = new Error('aborted')
        abort.name = 'AbortError'
        fetchNodeJsonMock.mockRejectedValue(abort)

        await expect(verify('ADDR(1)')).rejects.toBe(abort)
    })
})
