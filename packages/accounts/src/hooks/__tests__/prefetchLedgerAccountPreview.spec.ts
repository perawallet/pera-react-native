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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { prefetchLedgerAccountPreview } from '../prefetchLedgerAccountPreview'
import {
    getOnChainAccountStateQueryKey,
    getDelegatedAddressesQueryKey,
} from '../querykeys'

import {
    fakeAccountStateSnapshot,
    fakeAccountsChain,
    MAINNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const mocks = {
    get fetchAccountState() {
        return vi.mocked(fakeAccountsChain().adapter.fetchAccountState)
    },
    get fetchRekeyedAddresses() {
        return vi.mocked(fakeAccountsChain().adapter.fetchRekeyedAddresses!)
    },
}

describe('prefetchLedgerAccountPreview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.fetchAccountState.mockResolvedValue(fakeAccountStateSnapshot())
        mocks.fetchRekeyedAddresses.mockResolvedValue([])
    })

    it('primes the on-chain state and rekeyed-addresses query caches', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        await prefetchLedgerAccountPreview(queryClient, 'ADDR', MAINNET_SCOPE)

        expect(
            queryClient.getQueryData(
                getOnChainAccountStateQueryKey('ADDR', MAINNET_SCOPE),
            ),
        ).toBeDefined()
        expect(
            queryClient.getQueryData(
                getDelegatedAddressesQueryKey('ADDR', MAINNET_SCOPE),
            ),
        ).toBeDefined()
        expect(mocks.fetchAccountState).toHaveBeenCalledWith(
            'ADDR',
            MAINNET_SCOPE,
            { priorResourceCount: 0 },
        )
        expect(mocks.fetchRekeyedAddresses).toHaveBeenCalledWith(
            'ADDR',
            MAINNET_SCOPE,
        )
    })

    it('never rejects when a fetch fails (best-effort)', async () => {
        mocks.fetchRekeyedAddresses.mockRejectedValue(new Error('network'))
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        await expect(
            prefetchLedgerAccountPreview(queryClient, 'ADDR', MAINNET_SCOPE),
        ).resolves.toBeUndefined()
    })
})
