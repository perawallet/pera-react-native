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

import {
    InvalidScopeKeyError,
    LEGACY_CHAIN_ID,
    parseScopeKey,
    scopeFromNetworkColumn,
    toScopeKey,
    type AccountChainState,
    type ChainScope,
    type ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { logger } from '@perawallet/wallet-core-shared'
import { accountsChainAdapters } from '../chain-adapter'
import { getAllAccountBalances } from '../db'
import type { RecordedAuthorities, WalletAccount } from '../models'
import {
    useAccountChainStateStore,
    type AccountChainStateSlice,
} from './accountChainState'
import { useAccountsStore } from './store'

type Built = Record<string, Record<string, AccountChainState>>

const put = (
    built: Built,
    scope: ChainScope,
    address: string,
    state: AccountChainState,
): void => {
    const key = toScopeKey(scope)
    built[key] = { ...built[key], [address]: state }
}

const heldAddresses = (accounts: readonly WalletAccount[]): Set<string> => {
    const held = new Set<string>()
    for (const account of accounts) {
        for (const entry of Object.values(account.chains)) {
            if (entry?.address) held.add(entry.address)
        }
    }
    return held
}

/**
 * Fills the chain-state slice from the `account_balances` rows, then from the
 * authorities the accounts store persisted for scopes with no row. Entries
 * already held win: an in-session write is newer than the read. A recorded
 * authority is dropped only once a row carries that scope's observed state or
 * no account holds the address, so a restart without a sync keeps it. Never
 * throws.
 */
export async function hydrateAccountChainStates({
    db = getDatabase(),
}: { db?: Database } = {}): Promise<void> {
    try {
        const built: Built = {}

        for (const row of await getAllAccountBalances({ db })) {
            let scope: ChainScope
            try {
                scope = scopeFromNetworkColumn(row.network)
            } catch (error) {
                if (!(error instanceof InvalidScopeKeyError)) throw error
                logger.warn('Skipping a balance row with an unknown network', {
                    network: row.network,
                })
                continue
            }
            if (!accountsChainAdapters.has(scope.chainId)) continue
            put(
                built,
                scope,
                row.accountAddress,
                accountsChainAdapters.get(scope.chainId).toChainState(row),
            )
        }

        const accountsState = useAccountsStore.getState()
        const recorded: RecordedAuthorities = { ...accountsState.authorities }
        const selectedKey = toScopeKey(getSelectedScope(LEGACY_CHAIN_ID))
        for (const [address, authorityAddress] of Object.entries(
            accountsState.unscopedAuthorities,
        )) {
            if (recorded[selectedKey]?.[address]) continue
            recorded[selectedKey] = {
                ...recorded[selectedKey],
                [address]: authorityAddress,
            }
        }

        // Before the accounts store rehydrates its list is empty, which would
        // read as every recorded account being gone.
        const held = useAccountsStore.persist.hasHydrated()
            ? heldAddresses(accountsState.accounts)
            : undefined
        const settled: RecordedAuthorities = {}
        for (const [key, entries] of Object.entries(recorded) as [
            ChainScopeKey,
            Record<string, string>,
        ][]) {
            let scope: ChainScope | undefined
            try {
                scope = parseScopeKey(key)
            } catch (error) {
                if (!(error instanceof InvalidScopeKeyError)) throw error
            }
            for (const [address, authorityAddress] of Object.entries(entries)) {
                // A row is observed state, so it supersedes the record.
                if (built[key]?.[address]) continue
                if (held && !held.has(address)) continue
                settled[key] = { ...settled[key], [address]: authorityAddress }
                if (!scope || !accountsChainAdapters.has(scope.chainId))
                    continue
                put(
                    built,
                    scope,
                    address,
                    accountsChainAdapters
                        .get(scope.chainId)
                        .toChainState({ authorityAddress }),
                )
            }
        }

        useAccountChainStateStore
            .getState()
            .fillAccountChainStates(built as AccountChainStateSlice)
        accountsState.settleAuthorities(settled)
    } catch (error) {
        logger.warn('Account chain-state hydration failed', { error })
    }
}
