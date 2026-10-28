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
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    canSignWith,
    useAccountCapabilityScope,
    useAccountChainStateStore,
    useAllAccounts,
    useCapabilityChainResolver,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Nullable } from '@perawallet/wallet-core-shared'

/** The scope a swap for `account` runs on; null when none of its chains has swap. */
export const useSwapScope = (
    account: Nullable<WalletAccount>,
): Nullable<ChainScope> => useAccountCapabilityScope(account, 'swap')

export const useSelectedSwapScope = (): Nullable<ChainScope> =>
    useSwapScope(useSelectedAccount())

export const useSwapChainResolver = (): ((
    account: WalletAccount,
) => ChainId | undefined) => useCapabilityChainResolver('swap')

/** Accounts that something held can sign for on their swap chain. */
export const useSwapSigningAccounts = (): WalletAccount[] => {
    const accounts = useAllAccounts()
    const swapChainOf = useSwapChainResolver()
    const chainStates = useAccountChainStateStore(state => state.states)
    return useMemo(
        () =>
            accounts.filter(account => {
                const chainId = swapChainOf(account)
                return (
                    chainId !== undefined &&
                    canSignWith(account, accounts, chainId)
                )
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- chainStates re-runs the memo: canSignWith reads the chain-state store, not its arguments
        [accounts, swapChainOf, chainStates],
    )
}
