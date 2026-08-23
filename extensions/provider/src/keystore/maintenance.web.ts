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
import type { QuantumMaterialRepairResult } from './repairQuantumMaterial'
import type { PQDerivation } from './pqDerivation'

/**
 * Web build of the keystore maintenance surface. Both operations are
 * native-only and no-op here, each for its own reason — not merely because the
 * MMKV primitives are missing:
 *
 * - **Reconcile** exists because Android's passkey credential provider writes
 *   to the keystore from a second process. The extension has no such writer;
 *   keystore-web's engine owns its IndexedDB exclusively.
 * - **Material repair** re-mints Falcon children whose sealed material predates
 *   keystore custody. That state only exists on device, where quantum signing
 *   used to re-derive from the seed each time.
 *
 * Returning a zeroed result rather than throwing is deliberate: the bootstrap
 * calls this unconditionally and only logs when a count is non-zero, so web
 * stays silent instead of reporting work it did not do.
 */

export const readPersistedKeys = (): Key[] => []

export const runMaterialRepair = async (_deps: {
    keys: () => Key[]
    regenerate: (
        childId: string,
        parentKeyId: string,
        derivation: PQDerivation,
    ) => Promise<void>
}): Promise<QuantumMaterialRepairResult> => ({ repaired: 0, failed: 0 })
