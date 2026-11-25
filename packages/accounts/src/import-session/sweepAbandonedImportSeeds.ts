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
    provisionalSeedLockName,
    readProvisionalSeeds,
} from '@perawallet/wallet-core-kms'
import { logger, withLockIfFree } from '@perawallet/wallet-core-shared'
import { getKeystore } from '@perawallet/wallet-extension-provider'
import { useAccountsStore } from '../store'
import { useHDImportSessionStore } from './store'
import { discardUnclaimedImportSeed } from './provisionalImportSeeds'

/**
 * Removes the seeds an HD import saved and then lost track of when the
 * process died before the user confirmed or cancelled it. A seed needed by a
 * stored account or existing passkey is only unmarked.
 */
export const sweepAbandonedImportSeeds = async (
    removeKeyAndChildren: (seedId: string) => Promise<void>,
): Promise<void> => {
    if (readProvisionalSeeds().length === 0) return
    // Until both load, every seed would read as unused.
    if (!useAccountsStore.persist.hasHydrated()) return
    await getKeystore().ready

    for (const seedId of readProvisionalSeeds()) {
        if (seedId === useHDImportSessionStore.getState().pending?.walletKeyId)
            continue
        try {
            // Taken only when no other extension context is still importing it.
            await withLockIfFree(provisionalSeedLockName(seedId), () =>
                discardUnclaimedImportSeed(seedId, removeKeyAndChildren),
            )
        } catch (error) {
            // The mark stays, so the next launch tries again.
            logger.warn('Removing an abandoned import seed failed', { error })
        }
    }
}
