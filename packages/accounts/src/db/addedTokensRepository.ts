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

import { and, eq, inArray, ne, or } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import {
    parseScopeKey,
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type { AccountHoldingSource } from './holdingsQueries'
import { AccountAddedTokensSchema, AccountAssetHoldingsSchema } from './schema'

type AddedTokenParams = {
    db?: Database
    accountAddress: string
    scope: ChainScope
    assetId: string
}

export async function addAccountToken({
    db = getDatabase(),
    accountAddress,
    scope,
    assetId,
}: AddedTokenParams): Promise<void> {
    await db
        .insert(AccountAddedTokensSchema)
        .values({
            accountAddress,
            scope: toScopeKey(scope),
            assetId,
            addedAt: Date.now(),
        })
        .onConflictDoNothing()
        .run()
}

/** Its zero holding goes too; a held balance keeps showing until it's spent. */
export async function removeAccountToken({
    db = getDatabase(),
    accountAddress,
    scope,
    assetId,
}: AddedTokenParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    await db
        .delete(AccountAddedTokensSchema)
        .where(
            and(
                eq(AccountAddedTokensSchema.accountAddress, accountAddress),
                eq(AccountAddedTokensSchema.scope, scopeKey),
                eq(AccountAddedTokensSchema.assetId, assetId),
            ),
        )
        .run()
    await db
        .delete(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.scope, scopeKey),
                eq(AccountAssetHoldingsSchema.assetId, assetId),
                eq(AccountAssetHoldingsSchema.amount, new Decimal(0)),
            ),
        )
        .run()
}

type GetAddedTokenIdsParams = {
    db?: Database
    accountAddresses: readonly string[]
    scope: ChainScope
}

/** Every address asked for has an entry, empty when it added nothing. */
export async function getAddedTokenIdsByAccount({
    db = getDatabase(),
    accountAddresses,
    scope,
}: GetAddedTokenIdsParams): Promise<Map<string, string[]>> {
    const byAccount = new Map<string, string[]>(
        accountAddresses.map(address => [address, []]),
    )
    if (accountAddresses.length === 0) return byAccount
    const rows = await db
        .select({
            accountAddress: AccountAddedTokensSchema.accountAddress,
            assetId: AccountAddedTokensSchema.assetId,
        })
        .from(AccountAddedTokensSchema)
        .where(
            and(
                inArray(AccountAddedTokensSchema.accountAddress, [
                    ...accountAddresses,
                ]),
                eq(AccountAddedTokensSchema.scope, toScopeKey(scope)),
            ),
        )
        .orderBy(AccountAddedTokensSchema.addedAt)
        .all()
    for (const { accountAddress, assetId } of rows) {
        byAccount.get(accountAddress)?.push(assetId)
    }
    return byAccount
}

export async function deleteAllAddedTokensForAccount({
    db = getDatabase(),
    accountAddress,
}: {
    db?: Database
    accountAddress: string
}): Promise<void> {
    await db
        .delete(AccountAddedTokensSchema)
        .where(eq(AccountAddedTokensSchema.accountAddress, accountAddress))
        .run()
}

export type AccountAddedToken = {
    scope: ChainScope
    assetId: string
    /** False at a zero balance, or before the first sync reads one. */
    hasBalance: boolean
}

export async function getAccountAddedTokens({
    db = getDatabase(),
    sources,
}: {
    db?: Database
    sources: readonly AccountHoldingSource[]
}): Promise<AccountAddedToken[]> {
    if (sources.length === 0) return []
    const rows = await db
        .select({
            scope: AccountAddedTokensSchema.scope,
            assetId: AccountAddedTokensSchema.assetId,
            // Not the holding's asset_id: the two would share one column name.
            heldAmount: AccountAssetHoldingsSchema.amount,
        })
        .from(AccountAddedTokensSchema)
        .leftJoin(
            AccountAssetHoldingsSchema,
            and(
                eq(
                    AccountAssetHoldingsSchema.accountAddress,
                    AccountAddedTokensSchema.accountAddress,
                ),
                eq(
                    AccountAssetHoldingsSchema.scope,
                    AccountAddedTokensSchema.scope,
                ),
                eq(
                    AccountAssetHoldingsSchema.assetId,
                    AccountAddedTokensSchema.assetId,
                ),
                ne(AccountAssetHoldingsSchema.amount, new Decimal(0)),
            ),
        )
        .where(
            or(
                ...sources.map(({ address, scope }) =>
                    and(
                        eq(AccountAddedTokensSchema.accountAddress, address),
                        eq(AccountAddedTokensSchema.scope, toScopeKey(scope)),
                    ),
                ),
            ),
        )
        .all()
    return rows.map(({ scope, assetId, heldAmount }) => ({
        scope: parseScopeKey(scope),
        assetId,
        hasBalance: heldAmount !== null,
    }))
}
