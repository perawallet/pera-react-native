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

import type { AlgorandClient } from '@algorandfoundation/algokit-utils'

// Unit names and the note prefix tell the seeder's own output from anything else
// the account holds, so a rerun counts only what it made. A unit name is at most
// eight bytes: three letters leave five digits.
export const FUNGIBLE_UNIT_PREFIX = 'PSA'
export const NFT_UNIT_PREFIX = 'PSN'
export const PAYMENT_NOTE_PREFIX = 'pera-stress:'
export const MAX_SEEDED_ASSETS = 99_999

const PAGE_SIZE = 1000

/** How many assets of each kind the seeder has already created on `address`. */
export const countCreatedAssets = async (
    algorand: AlgorandClient,
    address: string,
): Promise<{ assets: number; nfts: number }> => {
    let assets = 0
    let nfts = 0
    let next: string | undefined
    do {
        let query = algorand.client.indexer
            .lookupAccountCreatedAssets(address)
            .limit(PAGE_SIZE)
        if (next) query = query.nextToken(next)
        const page = await query.do()
        for (const asset of page.assets) {
            if (asset.deleted) continue
            const unit = asset.params.unitName ?? ''
            if (unit.startsWith(FUNGIBLE_UNIT_PREFIX)) assets++
            else if (unit.startsWith(NFT_UNIT_PREFIX)) nfts++
        }
        // A public indexer may cap a page below the limit, so only a token ends the walk.
        next = page.assets.length > 0 ? page.nextToken : undefined
    } while (next)
    return { assets, nfts }
}

/**
 * How many seeder payments `address` has sent. The indexer trails the chain by a
 * few seconds, so a rerun straight after a run may undercount and send a few extra.
 */
export const countSeederPayments = async (
    algorand: AlgorandClient,
    address: string,
): Promise<number> => {
    let count = 0
    let next: string | undefined
    do {
        let query = algorand.client.indexer
            .searchForTransactions()
            .address(address)
            .addressRole('sender')
            .txType('pay')
            .notePrefix(new TextEncoder().encode(PAYMENT_NOTE_PREFIX))
            .limit(PAGE_SIZE)
        if (next) query = query.nextToken(next)
        const page = await query.do()
        count += page.transactions.length
        next = page.transactions.length > 0 ? page.nextToken : undefined
    } while (next)
    return count
}
