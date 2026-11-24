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

import { readProvisionalSeeds } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import { getKeystore } from '@perawallet/wallet-extension-provider'
import { useAccountsStore } from '../store'
import { useHDImportSessionStore } from './store'
import { discardUnclaimedImportSeed } from './provisionalImportSeeds'

/**
 * Removes the seeds an HD import saved and then lost track of when the
 * process died before the user confirmed or cancelled it. A seed any stored
 * account still uses is only unmarked, never removed.
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
            await discardUnclaimedImportSeed(seedId, removeKeyAndChildren)
        } catch (error) {
            // The mark stays, so the next launch tries again.
            logger.warn('Removing an abandoned import seed failed', { error })
        }
    }
}
