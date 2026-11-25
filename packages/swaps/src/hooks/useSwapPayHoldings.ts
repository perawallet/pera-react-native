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
    type ChainAssetBalance,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { isSwappableAsset } from '../utils/isSwappableAsset'
import { useSwapSourceChainsResolver } from './useSwapSourceChainsResolver'

export type UseSwapPayHoldingsResult = {
    /** Empty until every chain's read for the account lands. */
    holdings: ChainAssetBalance[]
    /** The chains the account can pay a swap from. */
    sourceChainIds: ChainId[]
    isPending: boolean
    /** A chain's read failed; the other chains' holdings are still listed. */
    isError: boolean
}

/** What `account` can pay a swap with, on the chains it can pay from. */
export const useSwapPayHoldings = (
    account: Nullable<WalletAccount>,
): UseSwapPayHoldingsResult => {
    const sourceChainsOf = useSwapSourceChainsResolver()
    const sourceChainIds = useMemo(
        () => (account ? sourceChainsOf(account) : []),
        [account, sourceChainsOf],
    )

    const accounts = useMemo(() => (account ? [account] : []), [account])
    const { assetBalances, isPending, isError } =
        useAccountsHoldingsAcrossChainsQuery(accounts)
    const hiddenTokens = useHiddenTokensStore(state => state.hiddenTokens)

    // A token the user hid is out of every list of what the account holds; unhiding it brings it back.
    const holdings = useMemo(() => {
        const isPayable = (holding: AccountChainAssetBalance) =>
            sourceChainIds.includes(holding.scope.chainId) &&
            holding.amount.gt(0) &&
            isSwappableAsset(holding.asset) &&
            !(
                canHideHolding(holding.scope.chainId, holding.assetId) &&
                hiddenAssetIdsOf(
                    hiddenTokens,
                    holding.address,
                    holding.scope,
                ).includes(holding.assetId)
            )
        return assetBalances
            .filter(isPayable)
            .map(
                ({ accountId: _accountId, address: _address, ...holding }) =>
                    holding,
            )
    }, [assetBalances, sourceChainIds, hiddenTokens])

    return {
        // Rows arriving chain by chain would move under a tap; show skeletons until every chain's read lands.
        holdings: isPending ? [] : holdings,
        sourceChainIds,
        isPending,
        isError,
    }
}
