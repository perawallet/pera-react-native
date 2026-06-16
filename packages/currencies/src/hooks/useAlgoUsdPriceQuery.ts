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

import { useQuery } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { eq, and } from 'drizzle-orm'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { decimalColumn, getDatabase } from '@perawallet/wallet-core-database'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import { currencyQueryKeys } from './querykeys'

const AssetPricesTable = sqliteTable('asset_prices', {
    assetId: decimalColumn('asset_id').notNull(),
    network: text('network').notNull(),
    usdPrice: decimalColumn('usd_price').notNull(),
})

const algoAssetIdDecimal = new Decimal(ALGO_ASSET_ID)

async function getAlgoPriceFromDb(network: string): Promise<Decimal> {
    const db = getDatabase()
    const rows = await db
        .select({ usdPrice: AssetPricesTable.usdPrice })
        .from(AssetPricesTable)
        .where(
            and(
                eq(AssetPricesTable.assetId, algoAssetIdDecimal),
                eq(AssetPricesTable.network, network),
            ),
        )
        .all()

    return rows[0]?.usdPrice ?? new Decimal(0)
}

export const useAlgoUsdPriceQuery = (enabled: boolean = true) => {
    const { network } = useNetwork()

    return useQuery({
        queryKey: currencyQueryKeys.algoUsdPrice(network),
        queryFn: () => getAlgoPriceFromDb(network),
        staleTime: Infinity,
        enabled,
    })
}
