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

import { registerStore } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const PROVISIONAL_SEEDS_KEY = 'kms-provisional-seeds'

/**
 * Seed ids saved before the user confirmed them (an HD import searching
 * chains that derive only inside the keystore). Persisted, unlike the import
 * session, so a seed the process died holding can still be found and removed
 * on the next launch. Ids only, never material.
 */
export const readProvisionalSeeds = (): string[] => {
    const ids = getProvider().keyValueStorage.getJSON<unknown>(
        PROVISIONAL_SEEDS_KEY,
    )
    return Array.isArray(ids)
        ? [
              ...new Set(
                  ids.filter(
                      (id): id is string =>
                          typeof id === 'string' && id.length > 0,
                  ),
              ),
          ]
        : []
}

const writeProvisionalSeeds = (ids: string[]): void => {
    const storage = getProvider().keyValueStorage
    if (ids.length === 0) storage.removeItem(PROVISIONAL_SEEDS_KEY)
    else storage.setJSON(PROVISIONAL_SEEDS_KEY, ids)
}

/** Call before the seed is saved, so no interruption leaves it unmarked. */
export const markSeedProvisional = (seedId: string): void => {
    const ids = readProvisionalSeeds()
    if (!ids.includes(seedId)) writeProvisionalSeeds([...ids, seedId])
}

/** Call once the seed is either referenced by a stored account or removed. */
export const clearProvisionalSeed = (seedId: string): void => {
    writeProvisionalSeeds(readProvisionalSeeds().filter(id => id !== seedId))
}

// Delete-all wipes the seeds these ids name; a surviving list would have the
// next launch sweep ids that no longer exist.
registerStore({
    name: PROVISIONAL_SEEDS_KEY,
    clearStorage: () =>
        getProvider().keyValueStorage.removeItem(PROVISIONAL_SEEDS_KEY),
    resetState: () => {},
})
