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

import { Decimal } from 'decimal.js'
import {
    refreshAccountHoldings,
    upsertAccountChainState,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { upsertAssetPrices, upsertAssets } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { upsertTransactions } from '@perawallet/wallet-core-transactions'
import type { BenchScale } from '../runner/types'
import { chainsFor } from './chains'
import {
    assetsHeldBy,
    benchAssets,
    benchHoldings,
    benchTransactions,
    benchWatchAccounts,
} from './generators'

export type SeededWallet = {
    accounts: WalletAccount[]
    /** Account 0's Algorand address: the one large wallet. */
    heavyAddress: string
    /** Every asset id any account holds. */
    heldAssetIds: string[]
    chainIds: string[]
}

export type SeedWalletOptions = {
    /** History rows cost a write each, so only the scenarios that read them ask. */
    withHistory?: boolean
    /** On by default; a scenario that fetches prices itself starts without them. */
    withPrices?: boolean
}

const NATIVE_BALANCE_MICROALGOS = 5_000_000_000
const BASE_MIN_BALANCE_MICROALGOS = 100_000

/**
 * Writes a wallet through the production stores and repositories: watch
 * accounts, the asset universe, prices for two assets in three, holdings, and
 * the chain-state row the sync keeps per account (which startup hydrates).
 * The heavy account holds every asset; the rest hold a rotating slice, so
 * accounts share assets the way real wallets do.
 */
export const seedWallet = async (
    scale: BenchScale,
    scope: ChainScope,
    { withHistory = false, withPrices = true }: SeedWalletOptions = {},
): Promise<SeededWallet> => {
    const chainIds = chainsFor(scale)
    const accounts = benchWatchAccounts(scale.accounts, chainIds)
    const heavyAddress = accounts[0].chains.algorand?.address ?? ''
    const universe = benchAssets(scale.heavyAccountAssets)

    useAccountsStore.getState().setAccounts(accounts)
    await upsertAssets({ items: universe, scope })
    if (withPrices) {
        await upsertAssetPrices({
            prices: universe
                .filter((_, i) => i % 3 !== 0)
                .map(asset => ({
                    assetId: asset.assetId,
                    usdPrice: new Decimal(
                        0.01 + (Number(asset.assetId) % 97) / 10,
                    ),
                })),
            scope,
        })
    }

    const native = {
        assetId: '0',
        amount: new Decimal(NATIVE_BALANCE_MICROALGOS),
    }
    for (const [index, account] of accounts.entries()) {
        const accountAddress = account.chains.algorand?.address ?? ''
        const held = assetsHeldBy(index, scale.assetsPerAccount, universe)
        await refreshAccountHoldings({
            accountAddress,
            holdings: [native, ...benchHoldings(held)],
            scope,
        })
        await upsertAccountChainState({
            accountAddress,
            scope,
            nativeBalance: native.amount,
            chainData: {
                family: 'algorand',
                minBalance: new Decimal(
                    BASE_MIN_BALANCE_MICROALGOS * (held.length + 1),
                ),
                status: 'Offline',
                totalAssetsOptedIn: held.length,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
            },
        })
    }

    if (withHistory) {
        await upsertTransactions({
            items: benchTransactions(
                heavyAddress,
                scale.heavyAccountTransactions,
            ),
            accountAddress: heavyAddress,
            scope,
        })
    }

    return {
        accounts,
        heavyAddress,
        heldAssetIds: universe.map(asset => asset.assetId),
        chainIds,
    }
}
