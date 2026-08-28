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

// endpoints → mappers now validates addresses via the blockchain barrel, which
// pulls native deps that don't load under node — stub the pure validator.
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: (address?: string) =>
        !!address && /^[0-9a-zA-Z]{58}$/.test(address),
}))

import {
    fetchNfdNamesForAddress,
    fetchNfdBulkRead,
    fetchNfdSearch,
} from '../endpoints'

const validNameResult = {
    name: 'alice.algo',
    source: 'nfd',
    image: '',
}

describe('fetchNfdNamesForAddress', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
        loggerMock.warn.mockReset()
    })

    test('GETs /v1/accounts/:address/names/ and maps the result', async () => {
        queryClientMock.mockResolvedValue({
            data: { results: [validNameResult] },
        })

        const result = await fetchNfdNamesForAddress({
            address: 'ADDR',
            network: 'mainnet',
        })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                network: 'mainnet',
                method: 'GET',
                url: '/v1/accounts/ADDR/names/',
            }),
        )
        expect(result).toEqual([validNameResult])
    })

    test('returns [] and logs a warning when the response fails schema validation', async () => {
        queryClientMock.mockResolvedValue({ data: { wrong: 'shape' } })

        const result = await fetchNfdNamesForAddress({
            address: 'ADDR',
            network: 'mainnet',
        })

        expect(result).toEqual([])
        expect(loggerMock.warn).toHaveBeenCalledWith(
            'NFD names response failed schema validation',
            expect.objectContaining({ error: expect.any(Object) }),
        )
    })
})

describe('fetchNfdBulkRead', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
        loggerMock.warn.mockReset()
    })

    test('POSTs the addresses to /bulk-read and maps per-address results', async () => {
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
            network: 'testnet',
        })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                url: '/v1/accounts/names/bulk-read/',
                data: { account_addresses: ['ADDR1', 'ADDR2'] },
            }),
        )
        expect(result).toEqual([
            { address: 'ADDR1', name: validNameResult },
            { address: 'ADDR2', name: null },
        ])
    })

    test('returns [] when schema validation fails', async () => {
        queryClientMock.mockResolvedValue({ data: null })

        const result = await fetchNfdBulkRead({
            addresses: ['ADDR1'],
            network: 'mainnet',
        })

        expect(result).toEqual([])
        expect(loggerMock.warn).toHaveBeenCalled()
    })
})

describe('fetchNfdSearch', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
        loggerMock.warn.mockReset()
    })

    test('GETs /search with the name as a query param and maps results', async () => {
        queryClientMock.mockResolvedValue({
            data: {
                count: 1,
                results: [
                    {
                        name: 'alice.algo',
                        address:
                            'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4',
                        service: { name: 'NFD', logo: 'logo-url' },
                    },
                ],
            },
        })

        const result = await fetchNfdSearch({
            name: 'alice',
            network: 'mainnet',
        })

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/name-services/search/',
                params: { name: 'alice' },
            }),
        )
        expect(result).toEqual([
            {
                name: 'alice.algo',
                address:
                    'A4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DVZ36IB4',
                service: { name: 'NFD', logo: 'logo-url' },
            },
        ])
    })

    test('returns [] when the search response fails schema validation', async () => {
        queryClientMock.mockResolvedValue({ data: { results: 'not-array' } })

        const result = await fetchNfdSearch({
            name: 'alice',
            network: 'mainnet',
        })

        expect(result).toEqual([])
        expect(loggerMock.warn).toHaveBeenCalled()
    })

    test('still calls queryClient on testnet', async () => {
        queryClientMock.mockResolvedValue({
            data: { count: 0, results: [] },
        })

        await fetchNfdSearch({ name: 'alice', network: 'testnet' })

        expect(queryClientMock).toHaveBeenCalled()
    })
})

describe('non-Pera-backed networks', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test.each(['betanet', 'custom'] as const)(
        'fetchNfdBulkRead returns [] without calling queryClient on %s',
        async network => {
            const result = await fetchNfdBulkRead({
                addresses: ['ADDR1'],
                network,
            })

            expect(result).toEqual([])
            expect(queryClientMock).not.toHaveBeenCalled()
        },
    )

    test.each(['betanet', 'custom'] as const)(
        'fetchNfdSearch returns [] without calling queryClient on %s',
        async network => {
            const result = await fetchNfdSearch({
                name: 'alice',
                network,
            })

            expect(result).toEqual([])
            expect(queryClientMock).not.toHaveBeenCalled()
        },
    )
})
