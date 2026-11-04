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

import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { chainAccountOf } from '../credentials/accessors'
import {
    accountValueKey,
    type AccountValueKey,
    type WalletAccount,
} from '../models'
import { useRegisteredChainIds } from './accountChainEntries'
import { useSigningAccountsOn } from './useSigningAccounts'

/**
 * The account's primary chain: the first registered chain, in registry order,
 * it has an address on. Enabling a chain later adds an entry to the same
 * record, so this is not the only one. The fallback covers a record with no
 * chain registered in this build; a stored record always holds at least one.
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

/** The account's first registered chain at its selected network; a display default, never an operation's chain. */
export const useAccountScope = (
    account: Maybe<WalletAccount>,
    fallbackChainId: ChainId,
): ChainScope => useSelectedScope(useAccountChainId(account, fallbackChainId))

/** The account's totals on `chainId`, looked up by its address there. */
export const accountValueOf = <V>(
    account: WalletAccount,
    chainId: ChainId,
    values: ReadonlyMap<AccountValueKey, V>,
): Optional<V> => {
    const address = chainAccountOf(account, chainId)?.address
    return address ? values.get(accountValueKey(chainId, address)) : undefined
}

/** Held accounts something held can sign for on any chain they hold. */
export const useSigningAccountsOnAnyChain = (): WalletAccount[] =>
    useSigningAccountsOn(useRegisteredChainIds())

/** The account's address on its first registered chain, for keys, copy and testIDs outside a hook. */
export const ownAddressOf = (account: WalletAccount): Optional<string> => {
    const registeredChainIds = getProvider()
        .chains.list()
        .map(({ id }) => id)
    return chainAccountOf(
        account,
        accountChainIdOf(account, registeredChainIds),
    )?.address
}
