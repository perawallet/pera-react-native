/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import {
    getDrizzle,
    type DrizzleDatabase,
} from '@perawallet/wallet-core-database'
import { AccountAssetHoldingsSchema } from './schema'

export type HoldingRow = {
    assetId: string
    amount: string
}

type UpsertAccountHoldingsParams = {
    db?: DrizzleDatabase
    accountAddress: string
    holdings: HoldingRow[]
    network: string
}

export function upsertAccountHoldings({
    db = getDrizzle(),
    accountAddress,
    holdings,
    network,
}: UpsertAccountHoldingsParams): void {
    const now = Date.now()

    db.delete(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .run()

    for (const holding of holdings) {
        db.insert(AccountAssetHoldingsSchema)
            .values({
                accountAddress,
                assetId: holding.assetId,
                network,
                amount: holding.amount,
                updatedAt: now,
            })
            .run()
    }
}

type GetAccountHoldingsParams = {
    db?: DrizzleDatabase
    accountAddress: string
    network: string
}

export function getAccountHoldings({
    db = getDrizzle(),
    accountAddress,
    network,
}: GetAccountHoldingsParams): HoldingRow[] {
    return db
        .select({
            assetId: AccountAssetHoldingsSchema.assetId,
            amount: AccountAssetHoldingsSchema.amount,
        })
        .from(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .all()
}
