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

import { describe, test, expect, vi, beforeEach } from 'vitest'

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
}))

// Only the networks a Pera backend serves carry a CAIP-2 id, as in the chains' descriptors.
const CAIP2: Record<string, Record<string, string>> = {
    algorand: {
        mainnet: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
        testnet: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
    },
    base: { mainnet: 'eip155:8453', sepolia: 'eip155:84532' },
}

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: (chainId: string) => ({
        networks: Object.entries(CAIP2[chainId] ?? {}).map(([id, caip2]) => ({
            id,
            caip2,
        })),
    }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    hasPeraBackend: (scope: { networkId: string }) =>
        scope.networkId !== 'betanet' && scope.networkId !== 'custom',
}))

import { fetchNfdBulkRead, fetchNameSearch } from '../endpoints'
import { nameServiceChainAdapters } from '../../chain-adapter'
import {
    fakeNameServiceAdapter,
    registerFakeNameServiceAdapter,
} from '../../__tests__/fakeNameServiceAdapter'

const ALGORAND_TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const BASE_MAINNET = { chainId: 'base', networkId: 'mainnet' } as const
const BASE_SEPOLIA = { chainId: 'base', networkId: 'sepolia' } as const

const ALGORAND_ADDRESS =
    'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4'
const EVM_ADDRESS = '0x1111111111111111111111111111111111111111'

beforeEach(() => {
    queryClientMock.mockReset()
    loggerMock.warn.mockReset()
    registerFakeNameServiceAdapter({
        isValidAddress: address =>
            address === ALGORAND_ADDRESS || address === EVM_ADDRESS,
    })
    nameServiceChainAdapters.register(
        fakeNameServiceAdapter({
            chainId: 'base',
            service: 'ens',
            isValidAddress: address => address === EVM_ADDRESS,
            // Stands in for ENSIP-15: folds width and case, refuses an underscore.
            normalizeName: name =>
                name.includes('_')
                    ? undefined
                    : name.normalize('NFKC').toLowerCase(),
        }),
    )
})

const validNameResult = {
    name: 'alice.algo',
    source: 'nfdomain',
    image: '',
}

describe('fetchNfdBulkRead', () => {
    test('POSTs the chain and addresses to the v4 names route and maps per-address results', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                results: [
                    { address: 'ADDR1', name: validNameResult },
                    { address: 'ADDR2', name: null },
                ],
            },
        })

        const result = await fetchNfdBulkRead({
            addresses: ['ADDR1', 'ADDR2'],
            scope: ALGORAND_TESTNET,
        })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                scope: ALGORAND_TESTNET,
                method: 'POST',
                url: '/api/v4/accounts/names/',
                data: {
                    chain: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe',
                    addresses: ['ADDR1', 'ADDR2'],
                },
            }),
        )
        expect(result).toEqual([
            { address: 'ADDR1', name: validNameResult },
            { address: 'ADDR2', name: null },
        ])
    })

    test("posts the scope's own CAIP-2 chain for an ENS chain", async () => {
        queryClientMock.mockResolvedValue({ data: { results: [] } })

        await fetchNfdBulkRead({
            addresses: [EVM_ADDRESS],
            scope: BASE_MAINNET,
        })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { chain: 'eip155:8453', addresses: [EVM_ADDRESS] },
            }),
        )
    })

    test('keeps only names already in the service normal form', async () => {
        const ens = (name: string) => ({
            ...validNameResult,
            name,
            source: 'ens',
        })
        queryClientMock.mockResolvedValue({
            data: {
                results: [
                    { address: 'ADDR1', name: ens('alice.eth') },
                    { address: 'ADDR2', name: ens('Alice.eth') },
                    { address: 'ADDR3', name: ens('bad_name.eth') },
                ],
            },
        })

        const result = await fetchNfdBulkRead({
            addresses: ['ADDR1', 'ADDR2', 'ADDR3'],
            scope: BASE_MAINNET,
        })

        expect(result.map(item => item.name?.name ?? null)).toEqual([
            'alice.eth',
            null,
            null,
        ])
    })

    test('returns an Algorand name untouched, since its adapter has no normalizeName', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                results: [
                    {
                        address: 'ADDR1',
                        name: { ...validNameResult, name: 'Alice.algo' },
                    },
                ],
            },
        })

        const result = await fetchNfdBulkRead({
            addresses: ['ADDR1'],
            scope: ALGORAND_MAINNET,
        })

        expect(result[0].name?.name).toBe('Alice.algo')
    })

    test('returns [] when schema validation fails', async () => {
        queryClientMock.mockResolvedValue({ data: null })

        const result = await fetchNfdBulkRead({
            addresses: ['ADDR1'],
            scope: ALGORAND_MAINNET,
        })

        expect(result).toEqual([])
        expect(loggerMock.warn).toHaveBeenCalled()
    })

    test('rejects when the backend cannot answer, rather than reading it as no names', async () => {
        queryClientMock.mockRejectedValue(new Error('503 upstream_unavailable'))

        await expect(
            fetchNfdBulkRead({
                addresses: ['ADDR1'],
                scope: ALGORAND_MAINNET,
            }),
        ).rejects.toThrow('503')
    })
})

describe('fetchNameSearch', () => {
    const response = (chain: string, address: string) => ({
        data: {
            count: 1,
            results: [
                {
                    name: 'alice.algo',
                    address,
                    chain,
                    service: { name: 'NFD', logo: 'logo-url' },
                },
            ],
        },
    })

    test("GETs the v4 search with the name and the scope's CAIP-2 chain and maps results", async () => {
        queryClientMock.mockResolvedValue(
            response(
                'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
                ALGORAND_ADDRESS,
            ),
        )

        const result = await fetchNameSearch({
            name: 'alice',
            scope: ALGORAND_MAINNET,
        })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/api/v4/name-services/search/',
                params: {
                    name: 'alice',
                    chain: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
                },
            }),
        )
        expect(result).toEqual([
            {
                name: 'alice.algo',
                address: ALGORAND_ADDRESS,
                service: { name: 'NFD', logo: 'logo-url' },
            },
        ])
    })

    test.each([
        [BASE_MAINNET, 'eip155:8453'],
        [BASE_SEPOLIA, 'eip155:84532'],
    ])('asks for %o on its own CAIP-2 chain', async (scope, chain) => {
        queryClientMock.mockResolvedValue({ data: { count: 0, results: [] } })

        await fetchNameSearch({ name: 'alice.eth', scope })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                params: { name: 'alice.eth', chain },
            }),
        )
    })

    test('drops a result for a chain other than the one asked', async () => {
        queryClientMock.mockResolvedValue(response('eip155:1', EVM_ADDRESS))

        const result = await fetchNameSearch({
            name: 'alice.eth',
            scope: BASE_MAINNET,
        })

        expect(result).toEqual([])
    })

    test('drops an ENS result for a name other than the one asked about', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                count: 1,
                results: [
                    {
                        name: 'mallory.eth',
                        address: EVM_ADDRESS,
                        chain: 'eip155:8453',
                        service: { name: 'ENS', logo: '' },
                    },
                ],
            },
        })

        const result = await fetchNameSearch({
            name: 'alice.eth',
            scope: BASE_MAINNET,
        })

        expect(result).toEqual([])
    })

    test('keeps an ENS result for the name asked about whatever its case', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                count: 1,
                results: [
                    {
                        name: 'alice.eth',
                        address: EVM_ADDRESS,
                        chain: 'eip155:8453',
                        service: { name: 'ENS', logo: '' },
                    },
                ],
            },
        })

        const result = await fetchNameSearch({
            name: 'Alice.ETH',
            scope: BASE_MAINNET,
        })

        expect(result.map(item => item.name)).toEqual(['alice.eth'])
    })

    test("keeps a result whose name is the normalised form of one that isn't just lowercase", async () => {
        queryClientMock.mockResolvedValue({
            data: {
                count: 1,
                results: [
                    {
                        name: 'alice.eth',
                        address: EVM_ADDRESS,
                        chain: 'eip155:8453',
                        service: { name: 'ENS', logo: '' },
                    },
                ],
            },
        })

        const result = await fetchNameSearch({
            name: 'Ａlice.eth',
            scope: BASE_MAINNET,
        })

        expect(result.map(item => item.name)).toEqual(['alice.eth'])
    })

    test('asks nothing for a name the service refuses', async () => {
        const result = await fetchNameSearch({
            name: 'al_ice.eth',
            scope: BASE_MAINNET,
        })

        expect(result).toEqual([])
        expect(queryClientMock).not.toHaveBeenCalled()
    })

    test('returns [] when the search response fails schema validation', async () => {
        queryClientMock.mockResolvedValue({ data: { results: 'not-array' } })

        const result = await fetchNameSearch({
            name: 'alice',
            scope: ALGORAND_MAINNET,
        })

        expect(result).toEqual([])
        expect(loggerMock.warn).toHaveBeenCalled()
    })

    test('rejects when the backend cannot answer', async () => {
        queryClientMock.mockRejectedValue(new Error('503 upstream_unavailable'))

        await expect(
            fetchNameSearch({ name: 'alice.eth', scope: BASE_MAINNET }),
        ).rejects.toThrow('503')
    })
})

describe('networks the v4 routes cannot serve', () => {
    test.each(['betanet', 'custom'] as const)(
        'fetchNfdBulkRead returns [] without calling queryClient on %s',
        async networkId => {
            const result = await fetchNfdBulkRead({
                addresses: ['ADDR1'],
                scope: { chainId: 'algorand', networkId },
            })

            expect(result).toEqual([])
            expect(queryClientMock).not.toHaveBeenCalled()
        },
    )

    test.each(['betanet', 'custom'] as const)(
        'fetchNameSearch returns [] without calling queryClient on %s',
        async networkId => {
            const result = await fetchNameSearch({
                name: 'alice',
                scope: { chainId: 'algorand', networkId },
            })

            expect(result).toEqual([])
            expect(queryClientMock).not.toHaveBeenCalled()
        },
    )

    test('a backed network without a CAIP-2 id is not asked about', async () => {
        const result = await fetchNameSearch({
            name: 'alice.eth',
            scope: { chainId: 'base', networkId: 'amoy' } as never,
        })

        expect(result).toEqual([])
        expect(queryClientMock).not.toHaveBeenCalled()
    })
})
