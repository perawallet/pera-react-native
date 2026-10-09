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
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    accountsChainAdapters,
    type AuthorityTargetCategory,
} from '../chain-adapter'
import type { WalletAccount } from '../models'
import { useAccountChainStateStore } from '../store'
import { useAllAccounts } from './useAllAccounts'

/**
 * Held accounts that `source`'s signing authority can move to under any of
 * the target kinds the scope's chain files under `category`. Empty when the
 * source is missing or the chain can't move authority.
 */
export const useAuthorityTargets = (
    source: WalletAccount | null | undefined,
    category: AuthorityTargetCategory,
    scope: ChainScope,
): WalletAccount[] => {
    const accounts = useAllAccounts()
    const chainStates = useAccountChainStateStore(
        state => state.states[toScopeKey(scope)],
    )

    return useMemo(() => {
        const authority = accountsChainAdapters.get(scope.chainId).authority
        if (!source || !authority) return []
        const kindIds = authority.targetKinds
            .filter(kind => kind.category === category)
            .map(kind => kind.id)
        return accounts.filter(target =>
            kindIds.some(kindId =>
                authority.isEligibleTarget(
                    kindId,
                    target,
                    source,
                    accounts,
                    scope,
                ),
            ),
        )
    }, [accounts, scope, chainStates, source, category])
}
