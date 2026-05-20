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

import type { QueryClient } from '@tanstack/react-query'
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import type { Network } from '@perawallet/wallet-core-shared'
import { fetchRekeyedAddresses } from '../account-discovery'
import { fetchOnChainAccountInformation } from './endpoints'
import {
    getOnChainAccountInformationQueryKey,
    getRekeyedAddressesQueryKey,
} from './querykeys'

/**
 * Best-effort warm-up of the two address-bound network queries the Ledger
 * account info sheet reads. Never throws — prefetch failures must not block
 * the discovery / selection / import flow.
 */
export const prefetchLedgerAccountPreview = async (
    queryClient: QueryClient,
    algokit: AlgorandClient,
    address: string,
    network: Network,
): Promise<void> => {
    if (!address) return

    await Promise.allSettled([
        queryClient.prefetchQuery({
            queryKey: getOnChainAccountInformationQueryKey(address, network),
            queryFn: () => fetchOnChainAccountInformation(algokit, address),
        }),
        queryClient.prefetchQuery({
            queryKey: getRekeyedAddressesQueryKey(address, network),
            queryFn: () => fetchRekeyedAddresses(address, network),
        }),
    ])
}
