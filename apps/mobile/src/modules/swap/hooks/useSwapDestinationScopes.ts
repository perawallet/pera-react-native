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
    canSignWith,
    chainAccountOf,
    isMultisigAccount,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    CHAIN_IDS,
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScopes } from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { isSwapChain } from '@perawallet/wallet-core-swaps'

/**
 * Where a swap from `account` on `scope` may pay out: `scope`, plus the
 * selected network of each other swap chain one of the user's own accounts can
 * sign on. A shared account stays on `scope`: its swap finishes later, through
 * the co-sign flow, with no order to track.
 */
export const useSwapDestinationScopes = (
    account: Nullable<WalletAccount>,
    scope: ChainScope,
): ChainScope[] => {
    const accounts = useAllAccounts()
    const isEligible = account !== null && !isMultisigAccount(account)

    const receivingChainIds = useMemo(
        () =>
            isEligible
                ? CHAIN_IDS.filter(
                      chainId =>
                          isSwapChain(chainId) &&
                          accounts.some(
                              // canSignWith can pass with no entry on the chain, leaving no address to pay.
                              candidate =>
                                  !!chainAccountOf(candidate, chainId) &&
                                  canSignWith(candidate, accounts, chainId),
                          ),
                  )
                : [],
        [isEligible, accounts],
    )
    const receivingScopes = useSelectedScopes(receivingChainIds)

    return useMemo(
        () => [
            scope,
            ...receivingScopes.filter(
                candidate => toScopeKey(candidate) !== toScopeKey(scope),
            ),
        ],
        [scope, receivingScopes],
    )
}
