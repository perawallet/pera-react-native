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
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    accountsChainAdapters,
    type AccountKindPresentation,
    type AuthorityTransitionLabel,
} from '../chain-adapter'
import type { WalletAccount } from '../models'
import type { DelegateTransition } from '../signer-resolution'
import { useAccountsStore } from '../store'

/** How the scope's chain shows the account's kind on that network; null for no account. */
export const useAccountPresentation = (
    account: Nullable<WalletAccount> | undefined,
    scope: ChainScope,
): Nullable<AccountKindPresentation> => {
    const accounts = useAccountsStore(state => state.accounts)
    return useMemo(
        () =>
            account
                ? accountsChainAdapters
                      .get(scope.chainId)
                      .presentation.describe(account, accounts, scope)
                : null,
        [account, accounts, scope],
    )
}

/** The glyph `chainId` shows for a kind without an account; undefined for an id it doesn't describe. */
export const accountKindGlyph = (
    kindId: string,
    chainId: ChainId,
): string | undefined =>
    accountsChainAdapters.get(chainId).presentation.kindGlyph(kindId)

/** The copy for an account whose signing authority moved, as `chainId` words it. */
export const authorityTransitionLabel = (
    transition: DelegateTransition,
    chainId: ChainId,
): AuthorityTransitionLabel =>
    accountsChainAdapters
        .get(chainId)
        .presentation.transitionLabel(transition.from, transition.to)
