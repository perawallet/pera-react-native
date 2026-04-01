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
import { sql } from 'drizzle-orm'
import { getDatabase } from '@perawallet/wallet-core-database'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { currencyQueryKeys } from './querykeys'

const ALGO_ASSET_ID = '0'

async function getAlgoPriceFromDb(network: string): Promise<string> {
    const db = getDatabase()

    const rows = await db.all<{ usd_price: string }>(
        sql`SELECT usd_price FROM asset_prices WHERE asset_id = ${ALGO_ASSET_ID} AND network = ${network} LIMIT 1`,
    )

    return rows[0]?.usd_price ?? '0'
}

export const useAlgoUsdPriceQuery = (enabled: boolean = true) => {
    const { network } = useNetwork()

    return useQuery({
        queryKey: currencyQueryKeys.algoUsdPrice(network),
        queryFn: () => getAlgoPriceFromDb(network),
        select: (data: string) => new Decimal(data),
        staleTime: Infinity,
        enabled,
    })
}
