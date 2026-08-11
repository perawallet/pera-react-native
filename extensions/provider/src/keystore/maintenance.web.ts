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

import type { Key } from '@algorandfoundation/keystore-core'
import type { KeystoreLayoutMigrationResult } from './migrateKeystoreLayout'
import type { QuantumMaterialRepairResult } from './repairQuantumMaterial'

/**
 * Web build of the keystore maintenance surface. All three operations are
 * native-only and no-op here, each for its own reason — not merely because the
 * MMKV primitives are missing:
 *
 * - **Reconcile** exists because Android's passkey credential provider writes
 *   to the keystore from a second process. The extension has no such writer;
 *   keystore-web's engine owns its IndexedDB exclusively.
 * - **Layout migration** rewrites canary.13's bare-id MMKV records into
 *   `m/`+`k/`. The browser build never had that layout — it is arriving at
 *   keystore-web from a vendored canary.12 port with its own storage, so there
 *   is nothing shaped like a canary.13 entry to find.
 * - **Material repair** re-mints Falcon children whose sealed material predates
 *   keystore custody. That state only exists on device, where quantum signing
 *   used to re-derive from the seed each time.
 *
 * Returning zeroed results rather than throwing is deliberate: the bootstrap
 * calls these unconditionally and only logs when a count is non-zero, so web
 * stays silent instead of reporting work it did not do.
 */

export const readPersistedKeys = (): Key[] => []

export const runLayoutMigration =
    async (): Promise<KeystoreLayoutMigrationResult> => ({
        migrated: 0,
        failed: 0,
        skipped: 0,
    })

export const runMaterialRepair = async (_deps: {
    keys: () => Key[]
    regenerate: (childId: string, parentKeyId: string) => Promise<void>
}): Promise<QuantumMaterialRepairResult> => ({ repaired: 0, failed: 0 })
