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

import { SyncService } from './service'
import type { SyncServiceDeps } from './models'
import type { Nullable } from '@perawallet/wallet-core-shared'

export type { SyncServiceDeps, SyncCompletionHandler } from './models'
export { SyncService } from './service'

let instance: Nullable<SyncService> = null

export const initializeSyncService = (deps: SyncServiceDeps): SyncService => {
    if (instance !== null) {
        instance.stop()
    }
    const newInstance = new SyncService(deps)
    instance = newInstance
    deps.registerCompletionHandler?.((addresses, network) =>
        newInstance.refreshAccounts(addresses, network),
    )
    return newInstance
}

/**
 * Pause/resume the poll loop if it exists, for UI that owns the JS thread for a
 * while (see `pauseSyncOnInteraction` on PWFlatList).
 *
 * Deliberately not routed through `getSyncService`, which throws when sync has
 * not been initialised: a list can mount and be scrolled before bootstrap
 * finishes, and in tests and previews where sync never starts at all. A gesture
 * must never be able to throw, so these no-op instead. Calls stay balanced
 * either way — with no instance there is nothing to leave paused.
 */
export const pauseSync = (): void => {
    instance?.pause()
}

export const resumeSync = (): void => {
    instance?.resume()
}

export const getSyncService = (): SyncService => {
    if (instance === null) {
        throw new Error(
            'SyncService not initialized. Call initializeSyncService() first.',
        )
    }
    return instance
}
