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

/** `ok: false` means the read itself threw — distinct from a note that reads back as absent. */
type RawRead =
    | { ok: true; raw: string | undefined }
    | { ok: false; error: unknown }

const parseIds = (raw: string | undefined): string[] => {
    if (raw === undefined) return []

    try {
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed)
            ? parsed.filter((id): id is string => typeof id === 'string')
            : []
    } catch {
        // A corrupt note can't be parsed, so there's nothing to union `ids`
        // against — overwriting it is the only forward option, not a
        // deliberately safe one.
        return []
    }
}

const safeErrorMessage = (error: unknown): string => {
    try {
        return error instanceof Error ? error.message : String(error)
    } catch {
        // A `toString`/`Symbol.toPrimitive` that itself throws must not
        // propagate out of a logging path.
        return '<unstringifiable error>'
    }
}

/** Never throws: a broken logger (RN patches `console.warn` via LogBox) must not escape `record`/`read` either. */
const safeWarn = (message: string): void => {
    try {
        console.warn(message)
    } catch {
        // no-op
    }
}

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
    // Every call site calls `record` outside its own `try` (that's the whole
    // point of the ledger — it must survive a revision that itself declined
    // because of a storage failure), so both the read and the write below
    // have to swallow their own failures rather than let this module become
    // the one unguarded storage call in the chain.
    const tryReadRaw = (module: string): RawRead => {
        try {
            return { ok: true, raw: store.getString(noteKey(module)) }
        } catch (error) {
            return { ok: false, error }
        }
    }

    const read = (module: string): string[] => {
        const result = tryReadRaw(module)
        if (!result.ok) {
            // Conflating "unreadable" with "nothing declined" would be silent
            // otherwise — a follow-up revision calling `read` to decide what
            // to re-attempt would see an empty list and conclude, wrongly,
            // that nothing was ever declined.
            safeWarn(
                `[provider] declined-register: could not read the ledger for ${module}, treating as nothing declined: ${safeErrorMessage(result.error)}`,
            )
            return []
        }
        return parseIds(result.raw)
    }

    return {
        read,
        record: (module, ids) => {
            if (ids.length === 0) return

            const result = tryReadRaw(module)
            if (!result.ok) {
                // Unlike a corrupt note, an unreadable one gives no evidence
                // its content is bad — it may still be perfectly good and
                // just transiently inaccessible. Unioning against `[]` here
                // would overwrite it with only `ids`, destroying data that
                // might have been recoverable. Once `up` resolves the runner
                // marks this revision applied, so barring a process killed
                // mid-run there is no retry — logged so a dev build has a
                // trace; release builds have none, which is why the note
                // itself matters.
                safeWarn(
                    `[provider] declined-register: could not read the ledger for ${module}, ${ids.length} id(s) left permanently unrecorded (${ids.join(', ')}): ${safeErrorMessage(result.error)}`,
                )
                return
            }

            const merged = new Set(parseIds(result.raw).concat([...ids]))
            try {
                store.set(noteKey(module), JSON.stringify([...merged]))
            } catch (error) {
                // Same reasoning as the read-failure branch above: once `up`
                // resolves there is no retry (barring a process killed
                // mid-run), so this loss is permanent in a release build.
                safeWarn(
                    `[provider] declined-register: ledger write failed for ${module}, ${ids.length} id(s) left permanently unrecorded (${ids.join(', ')}): ${safeErrorMessage(error)}`,
                )
            }
        },
    }
}
