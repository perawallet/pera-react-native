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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { accountsChainAdapters } from '../chain-adapter'
import { useAccountChainStateStore, useAccountsStore } from '../store'
import type { WalletAccount } from '../models'

/**
 * Locally held accounts that `address` is the authority of. Store-only, so it
 * misses delegations made outside the wallet until a rescan imports them —
 * cheap enough to call from render paths, unlike `useDelegatedAddressesQuery`,
 * which asks the indexer.
 */
export const useAccountsDelegatedTo = (
    address: string | null | undefined,
    chainId: ChainId,
): WalletAccount[] => {
    const accounts = useAccountsStore(state => state.accounts)
    // Reads every legacy scope, so any slice write can change the result.
    const chainStates = useAccountChainStateStore(state => state.states)
    return useMemo(() => {
        const authority = accountsChainAdapters.get(chainId).authority
        return address && authority
            ? authority.accountsDelegatedTo(address, accounts)
            : []
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chainStates re-runs the memo: accountsDelegatedTo reads the chain-state store, not its arguments
    }, [address, accounts, chainId, chainStates])
}

/** The addresses in `addresses` that some local account delegates its signing
 *  to: `useAccountsDelegatedTo` for a whole list in one subscription. */
export const useDelegationAuthorities = (
    addresses: readonly string[],
    chainId: ChainId,
): ReadonlySet<string> => {
    const accounts = useAccountsStore(state => state.accounts)
    // Reads every legacy scope, so any slice write can change the result.
    const chainStates = useAccountChainStateStore(state => state.states)
    return useMemo(() => {
        const authority = accountsChainAdapters.get(chainId).authority
        if (!authority) return new Set<string>()
        return new Set(
            addresses.filter(
                address =>
                    authority.accountsDelegatedTo(address, accounts).length > 0,
            ),
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chainStates re-runs the memo: accountsDelegatedTo reads the chain-state store, not its arguments
    }, [addresses, accounts, chainId, chainStates])
}
