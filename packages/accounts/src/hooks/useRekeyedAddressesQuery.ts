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
import {
    LEGACY_CHAIN_ID,
    legacyNetworkOf,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { fetchRekeyedAddresses } from '../chain-adapter'
import { getRekeyedAddressesQueryKey } from './querykeys'

type UseRekeyedAddressesQueryResult = {
    /** Addresses rekeyed to `address`; `undefined` until the query resolves */
    rekeyedAddresses: string[] | undefined
    isLoading: boolean
    isError: boolean
    refetch: () => void
}

export const useRekeyedAddressesQuery = (
    address: string,
): UseRekeyedAddressesQueryResult => {
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const network = legacyNetworkOf(scope)

    const query = useQuery({
        queryKey: getRekeyedAddressesQueryKey(address, scope),
        queryFn: () => fetchRekeyedAddresses(address, network),
        enabled: !!address,
        // 30s lets `prefetchLedgerAccountPreview`'s warm-up actually pay off
        // for the short-lived Ledger import session without serving
        // long-stale rekey data; rescan flows invalidate this key when
        // fresher data is explicitly required.
        staleTime: 30_000,
    })

    return {
        rekeyedAddresses: query.data,
        isLoading: query.isLoading,
        isError: query.isError,
        refetch: () => {
            void query.refetch()
        },
    }
}
