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

import { useEffect, useRef } from 'react'
import {
    hydrateConnectionsStore,
    type ConnectionRegistry,
} from '@perawallet/wallet-core-connections'
import { useNeedsMigration } from '@perawallet/wallet-core-migrate'
import { logger } from '@perawallet/wallet-core-shared'
// lanekeep-ignore-next-line pera/no-wc-imports-in-connections-module reason: the legacy v1 import is a boot step of the composition root, not a protocol decision
import { importLegacyConnections } from '@perawallet/wallet-core-walletconnect'
import { getKeystore, getProvider } from '@perawallet/wallet-extension-provider'
import { setActiveConnectionRegistry } from '../activeRegistry'

/**
 * Boots the registry in the one order that is safe: keystore ready, migration
 * gate closed, legacy import, `registry.initialize()`, mirror hydration.
 *
 * `importLegacyConnections` reads the keystore's reactive store synchronously
 * and reports "absent" before hydration; it and `migrateWalletConnect` both
 * dedupe against a `store.list()` snapshot, so the migration gate keeps them
 * from running concurrently; and a handler restored before the import has
 * written its records reports zero sessions, which reconciliation would then
 * delete.
 */
export const useConnectionsBoot = (registry: ConnectionRegistry): void => {
    // The duress wipe runs above this provider and cannot reach the context
    // (see `activeRegistry`). An effect, so StrictMode's mount/unmount/mount
    // pairs the clear with a set.
    useEffect(() => {
        setActiveConnectionRegistry(registry)
        return () => setActiveConnectionRegistry(null)
    }, [registry])

    const { isChecking, needsMigration } = useNeedsMigration()
    const bootStartedRef = useRef(false)
    const hydrateTeardownRef = useRef<(() => void) | null>(null)

    useEffect(() => {
        if (bootStartedRef.current) return
        if (isChecking || needsMigration) return
        bootStartedRef.current = true

        let cancelled = false

        void (async () => {
            try {
                await getKeystore().ready
                if (cancelled) return

                try {
                    await importLegacyConnections({
                        storage: getProvider().keyValueStorage,
                        store: getProvider().connections.store,
                    })
                } catch (error) {
                    // Crash-resumable: the importer upserts as it goes and
                    // retries the remainder next launch, so one bad record
                    // must not strand every other handler's restore.
                    logger.error(
                        'Legacy WalletConnect import failed; the remaining records retry next launch',
                        { error },
                    )
                }
                if (cancelled) return

                await registry.initialize()
                if (cancelled) return

                hydrateTeardownRef.current = hydrateConnectionsStore(
                    getProvider().connections.store,
                )
            } catch (error) {
                logger.error('Connections registry boot failed', { error })
            }
        })()

        return () => {
            cancelled = true
            hydrateTeardownRef.current?.()
            hydrateTeardownRef.current = null
            // A full data wipe reopens the migration gate while this stays
            // mounted; tearing down and resetting the guard lets the next
            // pass boot this same registry instance again.
            void registry.teardown().catch((error: unknown) => {
                logger.error('Connections registry teardown failed', {
                    error,
                })
            })
            bootStartedRef.current = false
        }
    }, [isChecking, needsMigration, registry])
}
