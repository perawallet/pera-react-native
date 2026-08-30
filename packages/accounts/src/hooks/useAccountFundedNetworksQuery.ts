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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { getAccountFundedNetworks } from '../db'
import { ensureAccountFetched } from '../sync/account-syncer'
import { getAccountFundedNetworksQueryKey } from './querykeys'

export type UseAccountFundedNetworksResult = {
    /** Networks whose persisted ALGO holding for this account is above zero. */
    fundedNetworks: string[]
    /** True once any network shows a non-zero ALGO balance. */
    isFunded: boolean
    isPending: boolean
    isError: boolean
}

/**
 * Whether an account holds ALGO on *any* network the wallet has synced, for
 * decisions that outlive the network switcher — a key-loss warning, say.
 *
 * A single indexed SQL read on the holdings primary key, cheap enough for list
 * rows. Only the active network is force-fetched when missing; the rest are
 * whatever previous syncs left behind, since the background sync only ever
 * polls the network in use.
 */
export const useAccountFundedNetworksQuery = (
    address?: string,
): UseAccountFundedNetworksResult => {
    const { network } = useNetwork()

    const query = useQuery({
        queryKey: getAccountFundedNetworksQueryKey(address ?? '', network),
        enabled: !!address,
        staleTime: Infinity,
        // SQLite is the source of truth; run offline rather than pausing (see
        // useAccountSummaryQuery).
        networkMode: 'always',
        queryFn: async () => {
            await ensureAccountFetched(address as string, network)
            return getAccountFundedNetworks({
                accountAddress: address as string,
            })
        },
    })

    const fundedNetworks = query.data ?? []

    return {
        fundedNetworks,
        isFunded: fundedNetworks.length > 0,
        isPending: query.isPending,
        isError: query.isError,
    }
}
