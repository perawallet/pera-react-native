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

import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import { addressOn } from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getInFlightSpends } from '../in-flight'
import {
    transferChainAdapters,
    type SpendableBalance,
    type SpendableBalanceInput,
} from '../transfer-adapter'
import { MODULE_PREFIX, transactionQueryKeys } from './querykeys'

export type UseSpendableBalanceQueryResult = {
    /** `undefined` until loaded; callers gate on it, so no default. */
    data: Optional<SpendableBalance>
    /** True while `data` is missing or still answers an earlier input. */
    isPending: boolean
}

export const useSpendableBalanceQuery = (
    input: Optional<SpendableBalanceInput>,
): UseSpendableBalanceQueryResult => {
    const address = input ? addressOn(input.account, input.scope) : undefined
    const isEnabled = !!input && !!address

    const query = useQuery({
        queryKey:
            input && address
                ? transactionQueryKeys.spendableBalance(
                      address,
                      input.asset,
                      input.scope,
                      input.fee.toString(),
                  )
                : [MODULE_PREFIX, 'spendable-balance'],
        queryFn:
            input && address
                ? async () => {
                      // The hook reads the ledger: an adapter must not read
                      // the signing database.
                      const inFlight = await getInFlightSpends({
                          address,
                          scope: input.scope,
                      })
                      return transferChainAdapters
                          .get(input.scope.chainId)
                          .spendableBalance({ ...input, inFlight })
                  }
                : skipToken,
        // A synced-state read, so it must not pause offline.
        networkMode: 'always',
        // The fee arriving re-keys the query; keep the last answer meanwhile
        // rather than dropping the screen back to a spinner.
        placeholderData: keepPreviousData,
    })

    return {
        data: query.data,
        // TanStack reports a skipped query as pending. Placeholder data is the
        // answer for an earlier input, so it still counts as pending.
        isPending: isEnabled && (query.isPending || query.isPlaceholderData),
    }
}
