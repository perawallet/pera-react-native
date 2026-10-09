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

import type { QueryClient } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { fetchRekeyedAddresses } from '../chain-adapter'
import {
    getOnChainAccountStateQueryKey,
    getDelegatedAddressesQueryKey,
} from './querykeys'
import { fetchOnChainAccountState } from './useOnChainAccountStateQuery'

/**
 * Best-effort warm-up of the two address-bound network queries the Ledger
 * account info sheet reads. Never throws — prefetch failures must not block
 * the discovery / selection / import flow.
 */
export const prefetchLedgerAccountPreview = async (
    queryClient: QueryClient,
    address: string,
    scope: ChainScope,
): Promise<void> => {
    if (!address) return

    await Promise.allSettled([
        queryClient.prefetchQuery({
            queryKey: getOnChainAccountStateQueryKey(address, scope),
            queryFn: () => fetchOnChainAccountState(address, scope),
        }),
        queryClient.prefetchQuery({
            queryKey: getDelegatedAddressesQueryKey(address, scope),
            queryFn: () => fetchRekeyedAddresses(address, scope),
        }),
    ])
}
