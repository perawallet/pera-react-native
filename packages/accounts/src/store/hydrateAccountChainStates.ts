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
    parseScopeKey,
    rekeyLegacyNetworkRecord,
    scopeFromNetworkColumn,
    toScopeKey,
    type AccountChainState,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import { logger } from '@perawallet/wallet-core-shared'
import { accountsChainAdapters } from '../chain-adapter'
import { addressOn } from '../credentials/accessors'
import { getAllAccountBalances } from '../db'
import { useAccountsStore } from './store'
import {
    useAccountChainStateStore,
    type AccountChainStateSlice,
} from './accountChainState'

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

/**
 * Fills the chain-state slice from the `account_balances` rows, then seeds
 * scopes with no row from `rekeyAddressByNetwork`. Entries already held win:
 * an in-session write is newer than the read. Never throws.
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

        // A row is observed state, so it beats the seed.
        for (const account of useAccountsStore.getState().accounts) {
            for (const [key, authAddress] of Object.entries(
                rekeyLegacyNetworkRecord(account.rekeyAddressByNetwork),
            )) {
                if (!authAddress) continue
                const scope = parseScopeKey(key)
                const address = addressOn(account, scope)
                if (
                    address === undefined ||
                    !accountsChainAdapters.has(scope.chainId) ||
                    built[key]?.[address]
                ) {
                    continue
                }
                put(
                    built,
                    scope,
                    address,
                    accountsChainAdapters
                        .get(scope.chainId)
                        .toChainState({ authAddress }),
                )
            }
        }

        useAccountChainStateStore
            .getState()
            .fillAccountChainStates(built as AccountChainStateSlice)
    } catch (error) {
        logger.warn('Account chain-state hydration failed', { error })
    }
}
