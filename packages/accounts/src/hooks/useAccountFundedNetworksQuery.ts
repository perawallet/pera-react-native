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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { chainAccountOf } from '../credentials/accessors'
import { getAccountFundedNetworks } from '../db'
import type { ChainAccount, WalletAccount } from '../models'
import { ensureAccountFetched } from '../sync/account-syncer'
import { getAccountFundedNetworksQueryKey } from './querykeys'

export type UseAccountFundedNetworksResult = {
    /** Scope keys (`chain/network`) on which the account holds a non-zero balance of any asset. */
    fundedNetworks: string[]
    /** True once any network shows a non-zero balance. */
    isFunded: boolean
    isPending: boolean
    isError: boolean
}

const combineLookups = (
    lookups: UseQueryResult<string[]>[],
): UseAccountFundedNetworksResult => {
    const fundedNetworks = [
        ...new Set(lookups.flatMap(lookup => lookup.data ?? [])),
    ]
    return {
        fundedNetworks,
        isFunded: fundedNetworks.length > 0,
        isPending: lookups.some(lookup => lookup.isPending),
        isError: lookups.some(lookup => lookup.isError),
    }
}

/**
 * Whether an account holds anything on *any* chain and network the wallet has
 * synced, for decisions that outlive the network switcher — a key-loss
 * warning, say.
 *
 * One indexed SQL read per chain address, cheap enough for list rows. Only the
 * active scope's address is force-fetched when missing; the rest are whatever
 * previous syncs left behind, since the background sync only ever polls the
 * network in use.
 */
export const useAccountFundedNetworksQuery = (
    account: Maybe<WalletAccount>,
    scope: ChainScope,
): UseAccountFundedNetworksResult => {
    const chainAccounts = account
        ? (Object.entries(account.chains) as [ChainId, Maybe<ChainAccount>][])
        : []
    const activeChainAccount = account
        ? chainAccountOf(account, scope.chainId)
        : undefined

    return useQueries({
        queries: chainAccounts.flatMap(([chainId, chainAccount]) =>
            chainAccount
                ? [
                      {
                          queryKey: getAccountFundedNetworksQueryKey(
                              chainAccount.address,
                              chainId,
                              scope,
                          ),
                          staleTime: Infinity,
                          // SQLite is the source of truth; run offline rather
                          // than pausing (see useAccountSummaryQuery).
                          networkMode: 'always' as const,
                          queryFn: async () => {
                              if (chainAccount === activeChainAccount) {
                                  await ensureAccountFetched(
                                      chainAccount.address,
                                      scope,
                                  )
                              }
                              return getAccountFundedNetworks({
                                  accountAddress: chainAccount.address,
                                  chainId,
                              })
                          },
                      },
                  ]
                : [],
        ),
        combine: combineLookups,
    })
}
