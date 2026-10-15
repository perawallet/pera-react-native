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
    LEGACY_CHAIN_ID,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    selectChainNetworkId,
    useNetworkStore,
    useSelectedScope,
} from '@perawallet/wallet-core-chain-shared'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { chainAccountOf } from '../credentials/accessors'
import type { WalletAccount } from '../models'
import { accountsChainAdapters } from '../chain-adapter'
import { canSignWith } from '../signer-resolution'
import { useAccountChainStateStore, useAccountsStore } from '../store'

/**
 * The one chain an account lives on: the first registered chain, in registry
 * order, it has an address on. Every creation path writes a single chain, so
 * the fallbacks only cover a record whose chain isn't registered in this build.
 */
export const accountChainIdOf = (
    account: WalletAccount,
    registeredChainIds: readonly ChainId[],
): ChainId =>
    registeredChainIds.find(
        chainId => chainAccountOf(account, chainId) !== undefined,
    ) ??
    (Object.keys(account.chains)[0] as ChainId | undefined) ??
    LEGACY_CHAIN_ID

export const useRegisteredChainIds = (): ChainId[] => {
    const key = getProvider()
        .chains.list()
        .map(({ id }) => id)
        .join()
    return useMemo(() => (key ? (key.split(',') as ChainId[]) : []), [key])
}

export const useAccountChainId = (account: Maybe<WalletAccount>): ChainId => {
    const registeredChainIds = useRegisteredChainIds()
    return account
        ? accountChainIdOf(account, registeredChainIds)
        : LEGACY_CHAIN_ID
}

/** The account's own chain at that chain's selected network. */
export const useAccountScope = (account: Maybe<WalletAccount>): ChainScope =>
    useSelectedScope(useAccountChainId(account))

/** The account's totals on its own chain, looked up by its address there. */
export const accountValueOf = <V>(
    account: WalletAccount,
    chainId: ChainId,
    values: ReadonlyMap<string, V>,
): V | undefined => {
    const address = chainAccountOf(account, chainId)?.address
    return address ? values.get(address) : undefined
}

/** Held accounts something held can sign for on the account's own chain. */
export const useSigningAccountsOnOwnChain = (): WalletAccount[] => {
    const accounts = useAccountsStore(state => state.accounts)
    const registeredChainIds = useRegisteredChainIds()
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
                    accountsChainAdapters.has(chainId) &&
                    canSignWith(account, accounts, chainId)
                )
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [accounts, registeredChainIds, chainStates, networksKey],
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
