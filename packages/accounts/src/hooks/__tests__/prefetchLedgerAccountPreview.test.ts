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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { prefetchLedgerAccountPreview } from '../prefetchLedgerAccountPreview'
import {
    getOnChainAccountInformationQueryKey,
    getRekeyedAddressesQueryKey,
} from '../querykeys'

const mocks = vi.hoisted(() => ({
    fetchOnChainAccountInformation: vi.fn(),
    fetchRekeyedAddresses: vi.fn(),
}))

// Paths are relative to THIS test file (hooks/__tests__/). The util lives in
// hooks/ and imports './endpoints' and '../account-discovery'.
vi.mock('../endpoints', () => ({
    fetchOnChainAccountInformation: mocks.fetchOnChainAccountInformation,
}))
vi.mock('../../account-discovery', () => ({
    fetchRekeyedAddresses: mocks.fetchRekeyedAddresses,
}))

describe('prefetchLedgerAccountPreview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.fetchOnChainAccountInformation.mockResolvedValue({
            address: 'ADDR',
            amount: 0n,
            minBalance: 0n,
            status: 'Offline',
            rewards: 0n,
            assets: [],
        })
        mocks.fetchRekeyedAddresses.mockResolvedValue([])
    })

    it('primes the on-chain info and rekeyed-addresses query caches', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const algokit = {} as never

        await prefetchLedgerAccountPreview(
            queryClient,
            algokit,
            'ADDR',
            'mainnet',
        )

        expect(
            queryClient.getQueryData(
                getOnChainAccountInformationQueryKey('ADDR', 'mainnet'),
            ),
        ).toBeDefined()
        expect(
            queryClient.getQueryData(
                getRekeyedAddressesQueryKey('ADDR', 'mainnet'),
            ),
        ).toBeDefined()
        expect(mocks.fetchOnChainAccountInformation).toHaveBeenCalledWith(
            algokit,
            'ADDR',
        )
        expect(mocks.fetchRekeyedAddresses).toHaveBeenCalledWith('ADDR')
    })

    it('never rejects when a fetch fails (best-effort)', async () => {
        mocks.fetchRekeyedAddresses.mockRejectedValue(new Error('network'))
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        await expect(
            prefetchLedgerAccountPreview(
                queryClient,
                {} as never,
                'ADDR',
                'mainnet',
            ),
        ).resolves.toBeUndefined()
    })
})
