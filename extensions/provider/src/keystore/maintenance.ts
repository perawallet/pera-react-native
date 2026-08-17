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

/**
 * One-off repairs of the on-disk keystore, and the only place in the provider
 * that touches the native keystore's storage primitives directly. It has a
 * `.web.ts` sibling because it is MMKV-shaped and has no meaning in the
 * browser build, where material lives in IndexedDB under keystore-web's own
 * master key.
 */

/**
 * `null` on a missing or unreadable entry, so a caller can skip it rather than
 * abort a whole reconcile pass.
 */
const decodeKeyEntry = (key: string): Key | null => {
    const raw = keystoreStorage.getString(key)
    if (!raw) return null

    try {
        return decode(raw) as Key
    } catch (err) {
        console.error(
            `[provider] keystore decode: failed to decode entry ${key}`,
            err,
        )
        return null
    }
}

/** Every key currently persisted, read straight from storage. */
export const readPersistedKeys = (): Key[] =>
    keystoreStorage
        .getAllKeys()
        .filter(key => key.startsWith(METADATA_PREFIX))
        .map(decodeKeyEntry)
        .filter((key): key is Key => key !== null)

/** Binds {@link repairQuantumMaterial} to the live keystore's storage. */
export const runMaterialRepair = (deps: {
    keys: () => Key[]
    regenerate: (childId: string, parentKeyId: string) => Promise<void>
}): Promise<QuantumMaterialRepairResult> =>
    repairQuantumMaterial({
        keys: deps.keys,
        storage: keystoreStorage,
        regenerate: deps.regenerate,
    })
