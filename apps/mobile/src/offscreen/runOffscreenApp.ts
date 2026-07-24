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

// Headless bootstrap for the 'offscreen' surface. This context is the DB
// host: it owns the sqlite worker, runs migrations BEFORE serving any proxy
// exec (single migration runner by construction), and keeps a slow warm-poll
// SyncService alive so a freshly opened popup shows warm data (design spec:
// "the offscreen document keeps light polling alive between popup opens").
import {
    createWorkerExecutor,
    onLocalStorageKeyChanged,
    startDatabaseHost,
} from '@perawallet/wallet-extension-platform-chrome'
import { getPlatformServices } from '@perawallet/wallet-extension-platform-driver'
import {
    getDatabase,
    initializeDatabase,
} from '@perawallet/wallet-core-database'
import { seedAlgoAsset } from '@perawallet/wallet-core-assets'
import {
    getSyncService,
    initializeSyncService,
} from '@perawallet/wallet-core-background'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import { usePollingStore } from '@perawallet/wallet-core-polling'
import { logger } from '@perawallet/wallet-core-shared'
import { queryClient } from '@providers/QueryProvider'

const OFFSCREEN_POLL_INTERVAL_MS = 30_000

// This context is long-lived while UI contexts are ephemeral: zustand persist
// hydrates once at import, so cross-context writes (onboarding an account in
// the expanded tab) must be re-read explicitly. Keys are `kv:` +
// STORE_NAME from each package's store.ts.
const REHYDRATE_BY_KEY: Record<
    string,
    { persist: { rehydrate: () => unknown } }
> = {
    'kv:accounts-store': useAccountsStore,
    'kv:network-store': useNetworkStore,
    'kv:polling-store': usePollingStore,
}

export const runOffscreenApp = async (): Promise<void> => {
    const services = getPlatformServices()

    const worker = new Worker('db-worker.js', { type: 'module' })
    const executor = createWorkerExecutor(worker)
    const host = startDatabaseHost(executor)

    // An unrecoverable worker crash (see worker-executor's error/messageerror
    // handling) flips the host un-ready (host.ts), but nothing recreates the
    // worker in this same document — there's no code path to re-run
    // migrations against a fresh worker in place. Self-closing instead makes
    // chrome.offscreen.hasDocument() report false, so the next
    // ensure-offscreen request (from ChromeDatabaseService's
    // ensureHostAvailable retry loop) creates a brand-new offscreen document
    // that reruns this bootstrap — migrations are tag-idempotent, so re-run
    // is safe.
    executor.onDeath?.(error => {
        logger.error(
            '[offscreen] db worker died, closing offscreen document for recreation',
            {
                error,
            },
        )
        window.close()
    })

    // Local execution path (host is active in this context): migrations run
    // here, before the host answers ready to anyone else.
    await initializeDatabase(services.database)
    await seedAlgoAsset(getDatabase())
    host.setReady()

    // NOTE: in the offscreen document chrome.storage is the SW-proxied shim
    // (installOffscreenStorageShim in App.web.tsx) — offscreen docs have no
    // native chrome.storage; onChanged events arrive relayed from the SW.
    // apps/mobile compiles without chrome ambient types, so the raw
    // chrome.storage.onChanged listener lives behind this platform-chrome helper.
    onLocalStorageKeyChanged(
        Object.keys(REHYDRATE_BY_KEY),
        key => void REHYDRATE_BY_KEY[key]?.persist.rehydrate(),
    )

    initializeSyncService({
        queryClient,
        pollIntervalMs: OFFSCREEN_POLL_INTERVAL_MS,
    })
    getSyncService().start()
    logger.info('[offscreen] database host ready, warm polling started')
}
