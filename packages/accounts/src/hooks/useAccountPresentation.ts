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
    I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable, Optional, Maybe } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { accountsChainAdapters, type AccountKindId } from '../chain-adapter'
import { hasCustody } from '../credentials/accessors'
import { eligibleChains } from '../credentials/eligibility'
import type { WalletAccount } from '../models'
import {
    accountPresentationChainAdapters,
    type AccountKindPresentation,
    type AuthorityTransitionLabel,
} from '../presentation-adapter'
import type { DelegateTransition } from '../signer-resolution'
import { useAccountsStore } from '../store'
import { accountChainIdOf } from './useAccountChain'

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
    account: Maybe<WalletAccount>,
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
): Optional<string> =>
    accountPresentationChainAdapters.has(chainId)
        ? accountPresentationChainAdapters
              .get(chainId)
              // The glyph doesn't follow signability, so any context gives it.
              .describe(kindId, { canSign: true })?.glyph
        : undefined

/**
 * The note the account's kind gives for being missing from a chain, when one
 * of `chainIds` is registered but out of its custody's reach; null otherwise,
 * or when the kind gives none.
 */
export const unreachableChainsNoteOf = (
    account: WalletAccount,
    chainIds: readonly ChainId[],
): Nullable<I18nKey> => {
    const { chains } = getProvider()
    const reachable = new Set(eligibleChains(account))
    const isMissing = chainIds.some(
        chainId => chains.has(chainId) && !reachable.has(chainId),
    )
    if (!isMissing) return null
    const ownChainId = accountChainIdOf(
        account,
        chains.list().map(({ id }) => id),
    )
    if (
        !accountsChainAdapters.has(ownChainId) ||
        !accountPresentationChainAdapters.has(ownChainId)
    ) {
        return null
    }
    return (
        accountPresentationChainAdapters
            .get(ownChainId)
            // The note follows the kind alone, so any context gives it.
            .describe(accountKindIdOf(account, ownChainId), { canSign: true })
            ?.unreachableChainsNoteKey ?? null
    )
}

/**
 * The first of `accounts`' notes for being missing from one of `chainIds`.
 * Null when any of them can reach one of the chains: the fix is then to add
 * the network to that account, which a kind's note would misattribute. A
 * watch account doesn't count, since it can't sign there.
 */
export const firstUnreachableChainsNote = (
    accounts: readonly WalletAccount[],
    chainIds: readonly ChainId[],
): Nullable<I18nKey> => {
    const { chains } = getProvider()
    const registered = chainIds.filter(chainId => chains.has(chainId))
    const isReachableByAny = accounts.some(account => {
        if (hasCustody(account, 'watch')) return false
        const reachable = eligibleChains(account)
        return registered.some(chainId => reachable.includes(chainId))
    })
    if (isReachableByAny) return null
    for (const account of accounts) {
        const note = unreachableChainsNoteOf(account, chainIds)
        if (note) return note
    }
    return null
}

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
