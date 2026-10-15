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
import {
    canDerive,
    nextChainPosition,
    useAccountsStore,
    useAllAccounts,
    useHdSeedGroups,
    type HdSeedGroup,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

export type UseDeriveChainAccountResult = {
    derivableWallets: HdSeedGroup[]
    deriveChainAccount: (walletId: string) => Promise<WalletAccount>
}

/** Mints `chainId`'s entry at the wallet's next free position; the store persists it at once. */
export const useDeriveChainAccount = (
    chainId: ChainId,
): UseDeriveChainAccountResult => {
    const accounts = useAllAccounts()
    const { hdSeedGroups } = useHdSeedGroups()

    const derivableWallets = useMemo(
        () =>
            hdSeedGroups.filter(group =>
                canDerive(accounts, group.seedKeyId, chainId),
            ),
        [hdSeedGroups, accounts, chainId],
    )

    const deriveChainAccount = useCallback(
        (walletId: string) => {
            // Read at call time: a render-time snapshot can miss an account
            // added while the progress overlay was opening.
            const { accounts: current, addChainAccount } =
                useAccountsStore.getState()
            return addChainAccount(
                walletId,
                chainId,
                nextChainPosition(current, walletId, chainId),
            )
        },
        [chainId],
    )

    return { derivableWallets, deriveChainAccount }
}
