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
import {
    METADATA_PREFIX,
    decode,
    storage as keystoreStorage,
} from '@algorandfoundation/react-native-keystore'
import {
    repairQuantumMaterial,
    type QuantumMaterialRepairResult,
} from './repairQuantumMaterial'
import type { PQDerivation } from './pqDerivation'

/**
 * One-off repairs of the on-disk keystore, and the only place in the provider
 * that touches the native keystore's storage primitives directly. It has a
 * `.web.ts` sibling because it is MMKV-shaped and has no meaning in the
 * browser build, where material lives in IndexedDB under keystore-web's own
 * master key.
 */

export type PersistedKeysResult = {
    keys: Key[]
    /** `k/`-prefixed storage keys whose records were present but undecodable. */
    failedIds: string[]
}

/**
 * Every key currently persisted, read straight from storage. An undecodable
 * record is skipped rather than aborting the whole pass, but reported in
 * `failedIds`: the engine's strict hydration will refuse that same record on
 * the next launch, so callers must be able to surface it while the app still
 * boots.
 */
export const readPersistedKeys = (): PersistedKeysResult => {
    const keys: Key[] = []
    const failedIds: string[] = []

    for (const storageKey of keystoreStorage.getAllKeys()) {
        if (!storageKey.startsWith(METADATA_PREFIX)) continue
        const raw = keystoreStorage.getString(storageKey)
        if (!raw) continue

        // `decode` also tolerates the pre-unification legacy payload, but the
        // engine's hydration (`listMeta`) is strict new-format-only. Reject
        // anything non-JSON here too, so this pass can never accept a record
        // that `keystore.ready` will refuse.
        if (!raw.startsWith('{')) {
            failedIds.push(storageKey)
            continue
        }

        try {
            keys.push(decode(raw) as Key)
        } catch {
            failedIds.push(storageKey)
        }
    }

    return { keys, failedIds }
}

/** Binds {@link repairQuantumMaterial} to the live keystore's storage. */
export const runMaterialRepair = (deps: {
    keys: () => Key[]
    regenerate: (
        childId: string,
        parentKeyId: string,
        derivation: PQDerivation,
    ) => Promise<void>
}): Promise<QuantumMaterialRepairResult> =>
    repairQuantumMaterial({
        keys: deps.keys,
        storage: keystoreStorage,
        regenerate: deps.regenerate,
    })
