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

import { eq, and } from 'drizzle-orm'
import type { Decimal } from 'decimal.js'
import {
    toScopeKey,
    type AccountChainState,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type { Optional } from '@perawallet/wallet-core-shared'
import { AccountChainStateSchema } from './schema'

export type AccountChainStateRow = {
    accountAddress: string
    /** Base units of the chain's native asset. */
    nativeBalance: Decimal
    chainData: AccountChainState
}

type UpsertAccountChainStateParams = {
    db?: Database
    accountAddress: string
    scope: ChainScope
    /** Base units of the chain's native asset. */
    nativeBalance: Decimal
    chainData: AccountChainState
}

export async function upsertAccountChainState({
    db = getDatabase(),
    accountAddress,
    scope,
    nativeBalance,
    chainData,
}: UpsertAccountChainStateParams): Promise<void> {
    const network = toScopeKey(scope)
    const now = Date.now()

    await db
        .insert(AccountChainStateSchema)
        .values({
            accountAddress,
            network,
            nativeBalance,
            chainData,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [
                AccountChainStateSchema.accountAddress,
                AccountChainStateSchema.network,
            ],
            set: { nativeBalance, chainData, updatedAt: now },
        })
        .run()
}

type GetAccountChainStateParams = {
    db?: Database
    accountAddress: string
    scope: ChainScope
}

export async function getAccountChainStateRow({
    db = getDatabase(),
    accountAddress,
    scope,
}: GetAccountChainStateParams): Promise<Optional<AccountChainStateRow>> {
    const network = toScopeKey(scope)
    const rows = await db
        .select({
            accountAddress: AccountChainStateSchema.accountAddress,
            nativeBalance: AccountChainStateSchema.nativeBalance,
            chainData: AccountChainStateSchema.chainData,
        })
        .from(AccountChainStateSchema)
        .where(
            and(
                eq(AccountChainStateSchema.accountAddress, accountAddress),
                eq(AccountChainStateSchema.network, network),
            ),
        )
        .all()

    return rows[0]
}

type DeleteAccountChainStateParams = {
    db?: Database
    accountAddress: string
}

/** Deletes every chain-state row for an account, across all networks. */
export async function deleteAccountChainState({
    db = getDatabase(),
    accountAddress,
}: DeleteAccountChainStateParams): Promise<void> {
    await db
        .delete(AccountChainStateSchema)
        .where(eq(AccountChainStateSchema.accountAddress, accountAddress))
        .run()
}
