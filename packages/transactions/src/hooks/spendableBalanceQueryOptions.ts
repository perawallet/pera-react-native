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

import { queryOptions, skipToken } from '@tanstack/react-query'
import { addressOn } from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getInFlightSpends } from '../in-flight'
import {
    transferChainAdapters,
    type SpendableBalance,
    type SpendableBalanceInput,
} from '../transfer-adapter'
import { MODULE_PREFIX, transactionQueryKeys } from './querykeys'

/** The query key and fetch for one input; shared by the single and many-input hooks. */
export const spendableBalanceQueryOptions = (
    input: Optional<SpendableBalanceInput>,
) => {
    const address = input ? addressOn(input.account, input.scope) : undefined
    return {
        isEnabled: !!input && !!address,
        options: queryOptions({
            queryKey:
                input && address
                    ? transactionQueryKeys.spendableBalance(
                          address,
                          input.asset,
                          input.scope,
                          input.fee,
                      )
                    : ([MODULE_PREFIX, 'spendable-balance'] as const),
            queryFn:
                input && address
                    ? async (): Promise<SpendableBalance> => {
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
        }),
    }
}
