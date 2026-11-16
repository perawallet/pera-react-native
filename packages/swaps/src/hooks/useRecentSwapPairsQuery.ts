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

import { useCallback, useMemo } from 'react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { SwapHistoryPair } from '../models'
import { pairsPaidBy } from '../utils/pairsPaidBy'
import { useDistinctPairsHistoryQuery } from './useDistinctPairsHistoryQuery'
import { useSwapAccountsAddresses } from './useSwapAccountsAddresses'
import { useSwapSigningAccounts } from './useSwapScope'
import { useSwapSourceChainsResolver } from './useSwapSourceChainsResolver'

export type UseRecentSwapPairsQueryResult = {
    pairs: SwapHistoryPair[]
    isLoading: boolean
    isError: boolean
    /** False when no account can sign a swap, so there is no history to read. */
    isEnabled: boolean
}

/** The newest distinct pairs the wallet's swap accounts paid for, each with its payer. */
export const useRecentSwapPairsQuery = (): UseRecentSwapPairsQueryResult => {
    const accounts = useSwapSigningAccounts()
    const sourceChainsOf = useSwapSourceChainsResolver()
    const payers = useSwapAccountsAddresses(accounts)
    const historyAccounts = useMemo(
        () => payers.map(({ scope, address }) => ({ scope, address })),
        [payers],
    )
    const { data, isLoading, isError } =
        useDistinctPairsHistoryQuery(historyAccounts)

    const sourceChains = useMemo(
        () =>
            new Map(
                accounts.map(account => [account.id, sourceChainsOf(account)]),
            ),
        [accounts, sourceChainsOf],
    )
    const canPayOn = useCallback(
        (accountId: string, chainId: ChainId) =>
            !!sourceChains.get(accountId)?.includes(chainId),
        [sourceChains],
    )

    const pairs = useMemo(
        () => pairsPaidBy(data ?? [], payers, canPayOn),
        [data, payers, canPayOn],
    )

    return { pairs, isLoading, isError, isEnabled: payers.length > 0 }
}
