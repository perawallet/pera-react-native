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

/**
 * The minimal store this register needs. Structural so it can be backed by the
 * ledger's MMKV instance in production and a plain object in tests.
 */
export type NoteStore = {
    getString: (key: string) => string | undefined
    set: (key: string, value: string) => void
}

/**
 * Durable record of storage keys a revision deliberately left alone.
 *
 * The migration runner marks a revision applied whenever `up` resolves, and
 * these revisions resolve by design — failing the module would reject
 * `keystore.ready` and stop the app booting. So a record the revision declined
 * is never revisited: `report.failed` stays empty, `utils.log` reaches no
 * registered logger, and `console.warn` reaches Metro in dev and nowhere in
 * release. Without a note on disk it is permanently un-migrated, permanently
 * unflagged, and invisible.
 *
 * Storage keys only, never key material — the same identifiers already written
 * to the console.
 */
export type DeclinedRegister = {
    read: (module: string) => string[]
    /** Unions `ids` into whatever the module has already recorded. */
    record: (module: string, ids: readonly string[]) => void
}

/**
 * Namespaced so a follow-up revision can find these without guessing, and so
 * the two keystore modules cannot overwrite each other's notes.
 */
const noteKey = (module: string): string =>
    `com.perawallet.wallet/declined-records/${module}`

/**
 * Backs a {@link DeclinedRegister} with `store`.
 *
 * `store` **must** be the migrations ledger's own MMKV instance, never the
 * keystore's: canary.19 mints the Keychain master key only while the keystore
 * instance is literally empty (`masterKeyForWrite`), so a note written there
 * would block the first write forever and a fresh install could never create an
 * account.
 */
export const createDeclinedRegister = (store: NoteStore): DeclinedRegister => {
    const read = (module: string): string[] => {
        const raw = store.getString(noteKey(module))
        if (raw === undefined) return []

        try {
            const parsed: unknown = JSON.parse(raw)
            return Array.isArray(parsed)
                ? parsed.filter((id): id is string => typeof id === 'string')
                : []
        } catch {
            // A corrupt note must not fail the revision that reads it; the
            // worst case is re-recording ids that were already there.
            return []
        }
    }

    return {
        read,
        record: (module, ids) => {
            if (ids.length === 0) return

            const merged = new Set(read(module).concat([...ids]))
            store.set(noteKey(module), JSON.stringify([...merged]))
        },
    }
}
