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

const mockQueryClient = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', () => ({
    queryClient: mockQueryClient,
}))

import { fetchStakingProjectsInfo } from '../endpoints'

describe('fetchStakingProjectsInfo', () => {
    beforeEach(() => {
        mockQueryClient.mockReset()
    })

    it('parses a populated TVL response', async () => {
        mockQueryClient.mockResolvedValue({
            data: {
                folks: { tvl_in_algo: '1000', tvl_in_usd: '1200' },
                pact: { tvl_in_algo: '2000', tvl_in_usd: '2500' },
            },
            status: 200,
        })

        const result = await fetchStakingProjectsInfo('mainnet')

        expect(Object.keys(result)).toEqual(['folks', 'pact'])
        expect(result.folks?.tvl_in_algo).toBe('1000')
    })

    it('treats an empty-body response (data: undefined) as no TVL data', async () => {
        mockQueryClient.mockResolvedValue({ data: undefined, status: 200 })

        const result = await fetchStakingProjectsInfo('mainnet')

        expect(result).toEqual({})
    })

    it('treats a null response as no TVL data', async () => {
        mockQueryClient.mockResolvedValue({ data: null, status: 200 })

        const result = await fetchStakingProjectsInfo('mainnet')

        expect(result).toEqual({})
    })

    it('still throws on a wrong-shape response', async () => {
        mockQueryClient.mockResolvedValue({
            data: 'not-a-record',
            status: 200,
        })

        await expect(fetchStakingProjectsInfo('mainnet')).rejects.toThrow()
    })
})
