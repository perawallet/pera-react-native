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

import { createMMKV, type MMKV } from 'react-native-mmkv'
import {
    keyValueLedger,
    type MigrationLedger,
    DEFAULT_LEDGER_KEY,
    type Revision,
} from '@algorandfoundation/provider-migrations'

/**
 * A dedicated instance, never the keystore's own. The keystore mints its
 * Keychain master key only while its MMKV is literally empty
 * (`masterKeyForWrite`), so a ledger blob sitting in there blocks the first
 * write forever and a fresh install can never create an account. Upstream's
 * `adoptLegacyRecords` excludes the ledger key from its own scan for the same
 * reason.
 */
export const PERA_MIGRATIONS_MMKV_ID = 'pera-provider-migrations'

let instance: MMKV | null = null

const storage = (): MMKV => {
    instance ??= createMMKV({ id: PERA_MIGRATIONS_MMKV_ID })
    return instance
}

/**
 * The ledger's own store, for the handful of migration-side notes that must
 * outlive a run without touching the keystore's instance (see
 * {@link PERA_MIGRATIONS_MMKV_ID}).
 */
export const peraMigrationNoteStore = () => storage()

export const createPeraMigrationLedger = (): MigrationLedger =>
    keyValueLedger({
        get: key => storage().getString(key) ?? null,
        set: (key, value) => storage().set(key, value),
    })

/**
 * Reads the keystore-migration ledger: module id → last applied revision.
 * An absent or unparseable blob reads as empty (matching upstream's tolerance).
 * Synchronous — MMKV reads are synchronous.
 */
export const readKeystoreMigrationLedger = (): Record<string, Revision> => {
    const raw = storage().getString(DEFAULT_LEDGER_KEY)
    if (!raw) return {}
    try {
        const parsed: unknown = JSON.parse(raw)
        return parsed && typeof parsed === 'object'
            ? (parsed as Record<string, Revision>)
            : {}
    } catch {
        return {}
    }
}

/**
 * Clears one module's recorded revisions so its revisions re-run on the next app
 * launch, leaving other modules untouched. Per-module BY DESIGN: a blanket wipe
 * would also re-run upstream `adopt-flat-records`, which transiently re-splits the
 * passkey credentials `repairs/0002` un-splits. Takes effect only after a full
 * relaunch (the migration run is a one-shot at construction).
 */
export const resetKeystoreMigrationModule = (moduleId: string): void => {
    const map = readKeystoreMigrationLedger()
    if (!(moduleId in map)) return
    delete map[moduleId]
    storage().set(DEFAULT_LEDGER_KEY, JSON.stringify(map))
}
