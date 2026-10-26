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

import { seedOf, type WalletAccount } from '@perawallet/wallet-core-accounts'
import { kmsCore } from '@perawallet/wallet-core-kms'

/**
 * Removes the seeds a scenario minted, so they don't pile up in the keystore
 * across runs. Accounts with no local seed are skipped.
 */
export const discardAccountKeys = async (
    accounts: readonly WalletAccount[],
): Promise<void> => {
    const seedIds = new Set(
        accounts.flatMap(account => {
            const seedId = seedOf(account)
            return seedId ? [seedId] : []
        }),
    )
    for (const seedId of seedIds) {
        await kmsCore.discardMintedSeed(seedId).catch(() => {})
    }
}
