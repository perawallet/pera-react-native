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

import { useMemo } from 'react'
import {
    canHideHolding,
    hiddenAssetIdsOf,
    useAccountsHoldingsAcrossChainsQuery,
    useHiddenTokensStore,
    type AccountChainAssetBalance,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    groupSwapPayHoldings,
    type SwapPayHolding,
} from '../utils/groupSwapPayHoldings'
import { isSwappableAsset } from '../utils/isSwappableAsset'
import { useSwapSigningAccounts } from './useSwapScope'
import { useSwapSourceChainsResolver } from './useSwapSourceChainsResolver'

export type UseSwapPayHoldingsResult = {
    /** Empty until every account's holdings are read. */
    holdings: SwapPayHolding[]
    /** Every chain some account can pay a swap from. */
    sourceChainIds: ChainId[]
    isPending: boolean
    /** A read failed; the other accounts' and chains' holdings are still listed. */
    isError: boolean
}

/** What every account that can sign a swap holds, on the chains it can pay from, one entry per asset. */
export const useSwapPayHoldings = (): UseSwapPayHoldingsResult => {
    const accounts = useSwapSigningAccounts()
    const sourceChainsOf = useSwapSourceChainsResolver()
    const sourceChainsByAccount = useMemo(
        () =>
            new Map(
                accounts.map(account => [account.id, sourceChainsOf(account)]),
            ),
        [accounts, sourceChainsOf],
    )
    const sourceChainIds = useMemo(
        () => [...new Set([...sourceChainsByAccount.values()].flat())],
        [sourceChainsByAccount],
    )

    const { assetBalances, isPending, isError } =
        useAccountsHoldingsAcrossChainsQuery(accounts)
    const hiddenTokens = useHiddenTokensStore(state => state.hiddenTokens)

    // A token the user hid is out of every list of what the account holds; unhiding it brings it back.
    const holdings = useMemo(() => {
        const isPayable = (holding: AccountChainAssetBalance) =>
            !!sourceChainsByAccount
                .get(holding.accountId)
                ?.includes(holding.scope.chainId) &&
            isSwappableAsset(holding.asset) &&
            !(
                canHideHolding(holding.scope.chainId, holding.assetId) &&
                hiddenAssetIdsOf(
                    hiddenTokens,
                    holding.address,
                    holding.scope,
                ).includes(holding.assetId)
            )
        return groupSwapPayHoldings(assetBalances.filter(isPayable))
    }, [assetBalances, sourceChainsByAccount, hiddenTokens])

    return {
        // A holding listed before every account's read lands could be picked
        // with holders missing, skipping the account choice.
        holdings: isPending ? [] : holdings,
        sourceChainIds,
        isPending,
        isError,
    }
}
