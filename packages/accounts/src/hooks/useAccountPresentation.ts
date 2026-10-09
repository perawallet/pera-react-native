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
import { accountsChainAdapters, type AccountKindId } from '../chain-adapter'
import type { WalletAccount } from '../models'
import {
    accountPresentationChainAdapters,
    type AccountKindPresentation,
    type AuthorityTransitionLabel,
} from '../presentation-adapter'
import type { DelegateTransition } from '../signer-resolution'
import { useAccountsStore } from '../store'

/** The account's kind as `chainId` names it, e.g. for analytics. */
export const accountKindIdOf = (
    account: WalletAccount,
    chainId: ChainId,
): AccountKindId => accountsChainAdapters.get(chainId).kindIdOf(account)

/**
 * How the scope's chain shows the account's kind on that network; null for
 * no account, or a chain or kind with no presentation, which the caller
 * shows with its generic copy.
 */
export const useAccountPresentation = (
    account: Nullable<WalletAccount> | undefined,
    scope: ChainScope,
): Nullable<AccountKindPresentation> => {
    const accounts = useAccountsStore(state => state.accounts)
    return useMemo(() => {
        if (!account || !accountPresentationChainAdapters.has(scope.chainId)) {
            return null
        }
        const adapter = accountsChainAdapters.get(scope.chainId)
        const canSign =
            adapter.resolveSigner(account, accounts, scope).kind === 'ok'
        return (
            accountPresentationChainAdapters
                .get(scope.chainId)
                .describe(adapter.kindIdOf(account), { canSign }) ?? null
        )
    }, [account, accounts, scope])
}

/** The glyph `chainId` shows for a kind without an account; undefined for a kind it doesn't describe. */
export const accountKindGlyph = (
    kindId: AccountKindId,
    chainId: ChainId,
): string | undefined =>
    accountPresentationChainAdapters.has(chainId)
        ? accountPresentationChainAdapters
              .get(chainId)
              // The glyph doesn't follow signability, so any context gives it.
              .describe(kindId, { canSign: true })?.glyph
        : undefined

/** The copy for an account whose signing authority moved, as `chainId` words it; null when the chain gives none. */
export const authorityTransitionLabel = (
    { from, to }: DelegateTransition,
    chainId: ChainId,
): Nullable<AuthorityTransitionLabel> => {
    if (!accountPresentationChainAdapters.has(chainId)) return null
    const presentation = accountPresentationChainAdapters.get(chainId)
    if (!presentation.transitionLabel) return null
    const accounts = accountsChainAdapters.get(chainId)
    return (
        presentation.transitionLabel(
            accounts.kindIdOf(from),
            accounts.kindIdOf(to),
        ) ?? null
    )
}
