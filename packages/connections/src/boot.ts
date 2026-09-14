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

import { logger } from '@perawallet/wallet-core-shared'
import type { ConnectionStoreAPI } from '@perawallet/wallet-extension-connections'
import type { ConnectionRegistry } from './registry'
import { hydrateConnectionsStore } from './store'

export type BootConnectionsOptions = {
    registry: ConnectionRegistry
    store: ConnectionStoreAPI
    keystoreReady: Promise<unknown>
    /** Legacy record import to run before the handlers restore. */
    importLegacy?: () => Promise<unknown>
    /** Checked between steps; once true the rest of the sequence is skipped. */
    isCancelled?: () => boolean
}

const noop = (): void => {}

/**
 * The order is load-bearing: the importer reads the keystore synchronously and
 * reports absent before hydration, and a handler restored before the import has
 * written its records reports zero sessions, which reconciliation would delete.
 */
export const bootConnections = async ({
    registry,
    store,
    keystoreReady,
    importLegacy,
    isCancelled = () => false,
}: BootConnectionsOptions): Promise<() => void> => {
    await keystoreReady
    if (isCancelled()) return noop

    if (importLegacy) {
        try {
            await importLegacy()
        } catch (error) {
            // The importer upserts as it goes and retries the remainder next
            // launch, so one bad record must not strand the other handlers' restore.
            logger.error(
                'Legacy connection import failed; the remaining records retry next launch',
                { error },
            )
        }
    }
    if (isCancelled()) return noop

    await registry.initialize()
    if (isCancelled()) return noop

    return hydrateConnectionsStore(store)
}
