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

import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { fetchDelegatedAddresses } from '../chain-adapter'
import { getDelegatedAddressesQueryKey } from './querykeys'

export type UseAnyDelegatedAddressesQueryResult = {
    /** Some lookup found at least one address delegated to its account. */
    hasDelegatedAddresses: boolean
    /** Every lookup has resolved; false while any is pending, paused or failed, true for an empty list. */
    isEveryLookupSuccessful: boolean
}

const combineLookups = (
    lookups: UseQueryResult<string[]>[],
): UseAnyDelegatedAddressesQueryResult => ({
    hasDelegatedAddresses: lookups.some(
        lookup => (lookup.data?.length ?? 0) > 0,
    ),
    isEveryLookupSuccessful: lookups.every(lookup => lookup.isSuccess),
})

export const useAnyDelegatedAddressesQuery = (
    addresses: readonly string[],
    scope: ChainScope,
): UseAnyDelegatedAddressesQueryResult =>
    useQueries({
        // Shares its key with `useDelegatedAddressesQuery`, so a prior fetch
        // for the same address is reused instead of doubling the round-trip.
        queries: addresses.map(address => ({
            queryKey: getDelegatedAddressesQueryKey(address, scope),
            queryFn: () => fetchDelegatedAddresses(address, scope),
            staleTime: 30_000,
        })),
        combine: combineLookups,
    })
