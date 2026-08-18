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
    readMasterKey,
    storage as keystoreStorage,
    type KeychainStorage,
} from '@algorandfoundation/react-native-keystore'
import { subtle } from 'react-native-quick-crypto'
import {
    repairQuantumMaterial,
    type QuantumMaterialRepairResult,
} from './repairQuantumMaterial'
import { peraMigrationNoteStore } from './migrationsLedger'
import {
    adoptStrandedRecords,
    emptyAdoptionResult,
    hasStrandedWork,
    type AdoptionResult,
} from './migrations/adopt/strandedRecords'
import { safeErrorMessage, safeWarn } from './migrations/safeLog'

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

const EXPECTED_FLAT_NOTE = 'com.perawallet.wallet/expected-flat-records'

type NoteStore = {
    getString: (key: string) => string | undefined
    set: (key: string, value: string) => void
}

export type StrandedRepairDeps = {
    storage: KeychainStorage
    subtle: SubtleCrypto
    masterKeyForRead: () => Promise<Uint8Array>
    noteStore: NoteStore
}

const readExpectedFlat = (noteStore: NoteStore): Set<string> => {
    try {
        return new Set(
            JSON.parse(
                noteStore.getString(EXPECTED_FLAT_NOTE) ?? '[]',
            ) as string[],
        )
    } catch {
        return new Set()
    }
}

/**
 * Binds {@link adoptStrandedRecords} to the live keystore's storage. Takes an
 * injectable `deps` — defaulting to the real keystore storage and the
 * migrations ledger's own note store — so tests never have to reach into the
 * live MMKV singleton.
 *
 * Not a tracked migration revision, for the same reason the quantum repair is
 * not: a ledgered revision that resolves is done forever, so one transient
 * write failure would freeze the damage permanently.
 *
 * Never throws: this runs on every launch ahead of the rest of boot, so a
 * failure here must be logged and skipped rather than surfaced — the guard
 * simply finds the same stranded work again on the next launch.
 */
export const runStrandedRepairWith = async (
    deps: StrandedRepairDeps,
): Promise<AdoptionResult> => {
    try {
        const expectedFlat = readExpectedFlat(deps.noteStore)
        if (!hasStrandedWork(deps.storage, expectedFlat)) {
            return emptyAdoptionResult()
        }

        const result = await adoptStrandedRecords({
            storage: deps.storage,
            subtle: deps.subtle,
            masterKeyForRead: deps.masterKeyForRead,
        })

        // Records that belong at their bare id forever — passkey credentials,
        // and payloads this build cannot decode. Without this note every
        // device holding a passkey pays for a full decode pass on every
        // launch.
        deps.noteStore.set(
            EXPECTED_FLAT_NOTE,
            JSON.stringify([...expectedFlat, ...result.leftFlat]),
        )

        return result
    } catch (error) {
        safeWarn(
            `[provider] stranded repair: guard failed, will retry next launch: ${safeErrorMessage(error)}`,
        )
        return emptyAdoptionResult()
    }
}

/** Binds {@link runStrandedRepairWith} to the live keystore and migrations-ledger note store. */
export const runStrandedRepair = (): Promise<AdoptionResult> =>
    runStrandedRepairWith({
        storage: keystoreStorage,
        subtle: subtle as unknown as SubtleCrypto,
        masterKeyForRead: () => readMasterKey(),
        noteStore: peraMigrationNoteStore(),
    })
