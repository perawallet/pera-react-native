/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    fetchAccountFastLookup,
    getAccountFastLookupEndpointPath,
} from '../account-fast-lookup'

describe('fetchAccountFastLookup', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('POSTs the address list to the fast-lookup endpoint and returns the response data', async () => {
        const responseData = [
            { address: 'ADDR1', accountExists: true },
            { address: 'ADDR2', accountExists: false },
        ]
        queryClientMock.mockResolvedValue({ data: responseData })

        const result = await fetchAccountFastLookup(
            ['ADDR1', 'ADDR2'],
            'mainnet',
        )

        expect(queryClientMock).toHaveBeenCalledWith({
            backend: 'pera',
            network: 'mainnet',
            method: 'POST',
            url: '/v1/accounts/fast-lookup/',
            data: { addresses: ['ADDR1', 'ADDR2'] },
        })
        expect(result).toEqual(responseData)
    })

    test('getAccountFastLookupEndpointPath returns the canonical URL path', () => {
        expect(getAccountFastLookupEndpointPath()).toBe(
            '/v1/accounts/fast-lookup/',
        )
    })
})
