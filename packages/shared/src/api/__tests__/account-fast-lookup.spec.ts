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

vi.mock('../query-client', () => ({
    queryClient: queryClientMock,
}))

import {
    fetchAccountExists,
    fetchAccountFastLookup,
    getAccountFastLookupEndpointPath,
} from '../account-fast-lookup'

describe('fetchAccountFastLookup', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('issues one GET per address and maps account_exists into accountExists', async () => {
        queryClientMock.mockImplementation(async ({ url }: { url: string }) => {
            if (url === '/v1/accounts/fast-lookup/ADDR1/') {
                return {
                    data: {
                        algo_value: '0.328',
                        usd_value: '0.10',
                        calculation_type: 'algo',
                        account_exists: true,
                    },
                }
            }
            return {
                data: {
                    algo_value: '0',
                    usd_value: '0',
                    calculation_type: 'algo',
                    account_exists: false,
                },
            }
        })

        const result = await fetchAccountFastLookup(
            ['ADDR1', 'ADDR2'],
            'mainnet',
        )

        expect(queryClientMock).toHaveBeenCalledTimes(2)
        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v1/accounts/fast-lookup/ADDR1/',
        })
        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v1/accounts/fast-lookup/ADDR2/',
        })

        expect(result).toEqual([
            { address: 'ADDR1', accountExists: true },
            { address: 'ADDR2', accountExists: false },
        ])
    })

    test('treats request failures as inactive accounts', async () => {
        queryClientMock.mockImplementation(async ({ url }: { url: string }) => {
            if (url === '/v1/accounts/fast-lookup/ADDR1/') {
                throw new Error('boom')
            }
            return { data: { account_exists: true } }
        })

        const result = await fetchAccountFastLookup(
            ['ADDR1', 'ADDR2'],
            'mainnet',
        )
        expect(result).toEqual([
            { address: 'ADDR1', accountExists: false },
            { address: 'ADDR2', accountExists: true },
        ])
    })

    test('getAccountFastLookupEndpointPath embeds the address in the URL', () => {
        expect(getAccountFastLookupEndpointPath('SOMEADDRESS')).toBe(
            '/v1/accounts/fast-lookup/SOMEADDRESS/',
        )
    })
})

describe('fetchAccountExists', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('maps account_exists for a single address', async () => {
        queryClientMock.mockResolvedValue({ data: { account_exists: true } })

        await expect(fetchAccountExists('ADDR1', 'mainnet')).resolves.toBe(true)
        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'GET',
            url: '/v1/accounts/fast-lookup/ADDR1/',
        })
    })

    test('throws on request failure so callers can distinguish probe-down from not-on-chain', async () => {
        queryClientMock.mockRejectedValue(new Error('offline'))

        await expect(fetchAccountExists('ADDR1', 'mainnet')).rejects.toThrow(
            'offline',
        )
    })
})
