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

import { useQuery } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { fetchDelegatedAddresses } from '../chain-adapter'
import { getDelegatedAddressesQueryKey } from './querykeys'

type UseDelegatedAddressesQueryResult = {
    /** Addresses delegated to `address`; `undefined` until the query resolves */
    delegatedAddresses: string[] | undefined
    isLoading: boolean
    isError: boolean
    refetch: () => void
}

export const useDelegatedAddressesQuery = (
    address: string,
    scope: ChainScope,
): UseDelegatedAddressesQueryResult => {
    const query = useQuery({
        queryKey: getDelegatedAddressesQueryKey(address, scope),
        queryFn: () => fetchDelegatedAddresses(address, scope),
        enabled: !!address,
        // 30s lets `prefetchLedgerAccountPreview`'s warm-up actually pay off
        // for the short-lived Ledger import session without serving
        // long-stale delegation data; rescan flows invalidate this key when
        // fresher data is explicitly required.
        staleTime: 30_000,
    })

    return {
        delegatedAddresses: query.data,
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: () => {
            void query.refetch()
        },
    }
}
