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

import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import { runAccountCleanups } from '@perawallet/wallet-core-shared'
import { deleteAssets, deleteAssetPrices } from '@perawallet/wallet-core-assets'
import {
    getHeldAssetIdsByAccount,
    deleteAllAssetHoldingsForAccount,
    deleteAccountBalance,
    getAllHeldAssetIdsForNetwork,
} from '../db'

export type CleanupRemovedAccountDataParams = {
    db?: Database
    accountAddress: string
}

export type CleanupRemovedAccountDataResult = {
    /** Networks the removed account held assets on. */
    networksAffected: string[]
    /** Asset IDs pruned (no longer referenced by any account), keyed by network. */
    prunedAssetIdsByNetwork: Record<string, string[]>
}

/**
 * Removes an account's holdings and balance rows, prunes any assets and prices
 * no remaining account holds or is opted into, then runs any account-cleanup
 * handlers other packages registered (e.g. transaction-row pruning).
 * Idempotent — safe for an address with no data.
 */
export async function cleanupRemovedAccountData({
    db = getDatabase(),
    accountAddress,
}: CleanupRemovedAccountDataParams): Promise<CleanupRemovedAccountDataResult> {
    // Read holdings before deleting so we know which assets might be orphaned.
    const held = await getHeldAssetIdsByAccount({ db, accountAddress })

    const hadByNetwork = new Map<string, Set<string>>()
    for (const { assetId, network } of held) {
        const set = hadByNetwork.get(network) ?? new Set<string>()
        set.add(assetId)
        hadByNetwork.set(network, set)
    }

    await deleteAllAssetHoldingsForAccount({ db, accountAddress })
    await deleteAccountBalance({ db, accountAddress })

    const prunedAssetIdsByNetwork: Record<string, string[]> = {}

    for (const [network, hadIds] of hadByNetwork) {
        const remaining = new Set(
            await getAllHeldAssetIdsForNetwork({ db, network }),
        )
        const orphans = [...hadIds].filter(id => !remaining.has(id))
        if (orphans.length === 0) continue

        await deleteAssets({ db, assetIds: orphans, network })
        await deleteAssetPrices({ db, assetIds: orphans, network })
        prunedAssetIdsByNetwork[network] = orphans
    }

    // Run cleanups other packages registered for this account (e.g. pruning
    // transaction rows), which cannot be called directly from here without a
    // package cycle. Best-effort — the registry logs and swallows handler
    // failures so they never block the removal flow.
    await runAccountCleanups({ db, accountAddress })

    const networksAffected = [...hadByNetwork.keys()]

    return { networksAffected, prunedAssetIdsByNetwork }
}
