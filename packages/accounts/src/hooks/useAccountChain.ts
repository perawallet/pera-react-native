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
    selectChainNetworkId,
    useNetworkStore,
    useSelectedScope,
    useSwitchedOffChainIds,
} from '@perawallet/wallet-core-chain-shared'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { chainAccountOf } from '../credentials/accessors'
import {
    accountValueKey,
    type AccountValueKey,
    type WalletAccount,
} from '../models'
import { accountsChainAdapters } from '../chain-adapter'
import { canSignWith } from '../signer-resolution'
import { useAccountChainStateStore, useAccountsStore } from '../store'
import { useRegisteredChainIds } from './accountChainEntries'

/**
 * The one chain an account lives on: the first registered chain, in registry
 * order, it has an address on. Every creation path writes a single chain, so
 * the fallback only covers a record whose chain isn't registered in this build;
 * a stored record always holds at least one.
 */
export const accountChainIdOf = (
    account: WalletAccount,
    registeredChainIds: readonly ChainId[],
): ChainId =>
    registeredChainIds.find(
        chainId => chainAccountOf(account, chainId) !== undefined,
    ) ?? (Object.keys(account.chains)[0] as ChainId)

export { useRegisteredChainIds }

/** `fallbackChainId` stands in while there is no account; a package can't pick it. */
export const useAccountChainId = (
    account: Maybe<WalletAccount>,
    fallbackChainId: ChainId,
): ChainId => {
    const registeredChainIds = useRegisteredChainIds()
    return account
        ? accountChainIdOf(account, registeredChainIds)
        : fallbackChainId
}

/** The account's own chain at that chain's selected network. */
export const useAccountScope = (
    account: Maybe<WalletAccount>,
    fallbackChainId: ChainId,
): ChainScope => useSelectedScope(useAccountChainId(account, fallbackChainId))

/** The account's totals on `chainId`, looked up by its address there. */
export const accountValueOf = <V>(
    account: WalletAccount,
    chainId: ChainId,
    values: ReadonlyMap<AccountValueKey, V>,
): V | undefined => {
    const address = chainAccountOf(account, chainId)?.address
    return address ? values.get(accountValueKey(chainId, address)) : undefined
}

/**
 * Held accounts something held can sign for on the account's own chain. A
 * switched-off chain signs nothing, so its accounts drop out even though their
 * last synced balances are still stored.
 */
export const useSigningAccountsOnOwnChain = (): WalletAccount[] => {
    const accounts = useAccountsStore(state => state.accounts)
    const registeredChainIds = useRegisteredChainIds()
    const switchedOffChainIds = useSwitchedOffChainIds()
    // Signer resolution reads the selected network's chain state, so both a
    // state write and a network switch must re-run the filter.
    const chainStates = useAccountChainStateStore(state => state.states)
    const networksKey = useNetworkStore(state =>
        registeredChainIds
            .map(chainId => selectChainNetworkId(state, chainId))
            .join(),
    )
    return useMemo(
        () =>
            accounts.filter(account => {
                const chainId = accountChainIdOf(account, registeredChainIds)
                return (
                    !switchedOffChainIds.includes(chainId) &&
                    accountsChainAdapters.has(chainId) &&
                    canSignWith(account, accounts, chainId)
                )
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            accounts,
            registeredChainIds,
            switchedOffChainIds,
            chainStates,
            networksKey,
        ],
    )
}

/** The account's address on its own chain, for keys, copy and testIDs outside a hook. */
export const ownAddressOf = (account: WalletAccount): string | undefined => {
    const registeredChainIds = getProvider()
        .chains.list()
        .map(({ id }) => id)
    return chainAccountOf(
        account,
        accountChainIdOf(account, registeredChainIds),
    )?.address
}
