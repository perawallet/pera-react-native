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

import { useQueries } from '@tanstack/react-query'
import type { Maybe } from '@perawallet/wallet-core-shared'
import type { WalletAccount } from '../models'
import { getAccountSummaryQueryKey } from './querykeys'
import { useAccountHoldingSources } from './useAccountHoldingSources'
import { readAccountSummary } from './useAccountSummaryQuery'

export type UseAccountHoldingsCountQueryResult = {
    /** Each chain's native holding included; a chain still loading counts 0, as `useAccountSummaryQuery` does. */
    holdingsCount: number
}

/** Holdings across every chain the account is on that isn't switched off. */
export const useAccountHoldingsCountQuery = (
    account: Maybe<WalletAccount>,
): UseAccountHoldingsCountQueryResult => {
    const sources = useAccountHoldingSources(account)
    const holdingsCount = useQueries({
        // Same key and options as `useAccountSummaryQuery`, so the header's
        // per-chain reads and this count share one cache entry each.
        queries: sources.map(({ address, scope }) => ({
            queryKey: getAccountSummaryQueryKey(address, scope),
            staleTime: Infinity,
            networkMode: 'always' as const,
            queryFn: () => readAccountSummary(address, scope),
        })),
        combine: results =>
            results.reduce(
                (total, result) => total + (result.data?.holdingsCount ?? 0),
                0,
            ),
    })
    return { holdingsCount }
}
