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

import type { StateCreator, StoreMutatorIdentifier } from 'zustand'
import {
    // oxlint-disable-next-line no-restricted-imports -- the one sanctioned wrapper
    persist,
    type PersistOptions,
    type PersistStorage,
    type StorageValue,
} from 'zustand/middleware'
import { AppError, ErrorCategory } from '../errors/base'
import type { Nullable, Optional } from './types'

/** The synchronous key-value surface every platform's `keyValueStorage` exposes. */
export type QuarantinableStorage = {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
}

export type QuarantineReason =
    | 'unreadable'
    | 'missing-migrate'
    | 'migrate-failed'
    | 'merge-failed'
    | 'newer-version'

export type QuarantinedState = {
    reason: QuarantineReason
    /** The version stamped on the stored blob, when it could be parsed. */
    storedVersion: Optional<number>
    codeVersion: number
    /** Epoch milliseconds. */
    quarantinedAt: number
    /** The stored value byte-for-byte, so a later build can re-run a fixed migrate over it. */
    raw: string
}

export type GuardedPersistOptions<S, U = S> = Omit<
    PersistOptions<S, U>,
    'storage'
> & {
    storage: () => QuarantinableStorage
    // Untyped on purpose: the blob is only trusted after migrate, and a typed
    // value here would make TS infer the persisted shape from the serializer.
    serialize?: (value: StorageValue<unknown>) => string
    deserialize?: (raw: string) => StorageValue<unknown>
}

/** Where quarantines are reported; the logger in the app, a no-op in test mocks. */
export type QuarantineReporter = {
    critical(error: Error, context: Record<string, unknown>): void
    warn(message: string, context: Record<string, unknown>): void
}

export class PersistedStateQuarantinedError extends AppError {
    constructor(storeName: string, reason: QuarantineReason) {
        super(
            `Persisted store "${storeName}" could not be restored (${reason}); its stored state was quarantined`,
            { category: ErrorCategory.STORAGE },
        )
        this.name = 'PersistedStateQuarantinedError'
    }
}

export const quarantineKeyFor = (storeName: string): string =>
    `${storeName}::quarantine`

const parseEntries = (value: string): Nullable<QuarantinedState[]> => {
    try {
        const parsed: unknown = JSON.parse(value)
        return Array.isArray(parsed) ? (parsed as QuarantinedState[]) : null
    } catch {
        return null
    }
}

export const readQuarantinedStates = (
    storage: QuarantinableStorage,
    storeName: string,
): QuarantinedState[] => {
    const value = storage.getItem(quarantineKeyFor(storeName))
    return value === null ? [] : (parseEntries(value) ?? [])
}

const writeQuarantine = (
    storage: QuarantinableStorage,
    storeName: string,
    entry: QuarantinedState,
): void => {
    const key = quarantineKeyFor(storeName)
    const existing = storage.getItem(key)
    let entries: QuarantinedState[] = []
    if (existing !== null) {
        // A damaged quarantine record is itself kept as an entry, never dropped.
        entries = parseEntries(existing) ?? [
            {
                ...entry,
                reason: 'unreadable',
                storedVersion: undefined,
                raw: existing,
            },
        ]
    }
    // A blob that fails the same way every launch is copied once, not per launch.
    if (entries.some(e => e.raw === entry.raw)) return
    storage.setItem(key, JSON.stringify([...entries, entry]))
}

const defaultMerge = <S>(persisted: unknown, current: S): S => ({
    ...current,
    ...(persisted as Partial<S>),
})

const guardOptions = <S, U>(
    reporter: QuarantineReporter,
    {
        storage: getStorage,
        serialize = JSON.stringify,
        deserialize = raw => JSON.parse(raw) as StorageValue<unknown>,
        migrate,
        merge = defaultMerge,
        ...options
    }: GuardedPersistOptions<S, U>,
): PersistOptions<S, U> => {
    // Resolved once at store creation, as createJSONStorage did: a factory that
    // throws leaves the store unpersisted rather than failing to load.
    let kv: QuarantinableStorage
    try {
        kv = getStorage()
    } catch {
        // An explicit undefined: omitting the key lets persist default to localStorage.
        return { ...options, storage: undefined, migrate, merge }
    }
    const codeVersion = options.version ?? 0
    let lastRaw: Nullable<string> = null
    let lastStoredVersion: Optional<number>
    // Set only when the stored blob can't be copied aside: it is then the sole
    // copy, so writes are dropped for the session rather than overwrite it.
    let writesBlocked = false

    const preserve = (reason: QuarantineReason, cause?: unknown): void => {
        if (lastRaw === null) return
        try {
            writeQuarantine(kv, options.name, {
                reason,
                storedVersion: lastStoredVersion,
                codeVersion,
                quarantinedAt: Date.now(),
                raw: lastRaw,
            })
        } catch (error) {
            writesBlocked = true
            reporter.critical(
                new PersistedStateQuarantinedError(options.name, reason),
                { cause, quarantineError: error, writesBlocked },
            )
            return
        }
        const context = {
            cause,
            storedVersion: lastStoredVersion,
            codeVersion,
        }
        // Opening an older build over newer data is a tester's downgrade, not a bug.
        if (reason === 'newer-version') {
            reporter.warn(
                new PersistedStateQuarantinedError(options.name, reason)
                    .message,
                context,
            )
        } else {
            reporter.critical(
                new PersistedStateQuarantinedError(options.name, reason),
                context,
            )
        }
    }

    const storage: PersistStorage<U> = {
        getItem: name => {
            lastRaw = null
            lastStoredVersion = undefined
            let raw: Nullable<string>
            try {
                raw = kv.getItem(name)
            } catch (error) {
                writesBlocked = true
                reporter.critical(
                    new PersistedStateQuarantinedError(name, 'unreadable'),
                    { cause: error, writesBlocked },
                )
                return null
            }
            if (raw === null) return null
            lastRaw = raw
            try {
                const value = deserialize(raw)
                lastStoredVersion = value.version
                // Unvalidated until migrate/merge, which take it as unknown anyway.
                return value as StorageValue<U>
            } catch (error) {
                preserve('unreadable', error)
                return null
            }
        },
        setItem: (name, value) => {
            if (writesBlocked) return
            kv.setItem(name, serialize(value))
        },
        removeItem: name => {
            kv.removeItem(name)
            kv.removeItem(quarantineKeyFor(name))
        },
    }

    // zustand persist only calls migrate on a version mismatch, and on a throw
    // it keeps the initial state, which the next set() then writes over the
    // stored blob. Returning undefined instead lands on the same defaults, but
    // only after the blob has been copied aside.
    const guardedMigrate = (
        persistedState: unknown,
        version: number,
    ): U | Promise<U> => {
        if (version > codeVersion) preserve('newer-version')
        if (!migrate) {
            if (version < codeVersion) preserve('missing-migrate')
            return undefined as U
        }
        const onFailure = (error: unknown): U => {
            preserve('migrate-failed', error)
            return undefined as U
        }
        try {
            const result = migrate(persistedState, version)
            return result instanceof Promise ? result.catch(onFailure) : result
        } catch (error) {
            return onFailure(error)
        }
    }

    const guardedMerge = (persistedState: unknown, currentState: S): S => {
        try {
            return merge(persistedState, currentState)
        } catch (error) {
            preserve('merge-failed', error)
            return currentState
        }
    }

    return { ...options, storage, migrate: guardedMigrate, merge: guardedMerge }
}

type GuardedPersist = <
    T,
    Mps extends [StoreMutatorIdentifier, unknown][] = [],
    Mcs extends [StoreMutatorIdentifier, unknown][] = [],
    U = T,
>(
    initializer: StateCreator<T, [...Mps, ['zustand/persist', unknown]], Mcs>,
    options: GuardedPersistOptions<T, U>,
    // The persisted shape is erased to `unknown`, as createJSONStorage left it,
    // so stores keep typing themselves `WithPersist<StoreApi<S>, unknown>`.
) => StateCreator<T, Mps, [['zustand/persist', unknown], ...Mcs]>

/**
 * zustand's `persist`, except that state it cannot restore is never lost. When
 * the stored blob won't parse, has no migrate path, or its migrate or merge
 * throws, the raw blob is appended to the `<name>::quarantine` key and
 * reported before the store falls back to its defaults; a blob from a newer
 * build is copied the same way before an older build rewrites it.
 * `clearStorage()` removes the quarantined copies with the store.
 */
export const createGuardedPersist =
    (reporter: QuarantineReporter): GuardedPersist =>
    <
        T,
        Mps extends [StoreMutatorIdentifier, unknown][] = [],
        Mcs extends [StoreMutatorIdentifier, unknown][] = [],
        U = T,
    >(
        initializer: StateCreator<
            T,
            [...Mps, ['zustand/persist', unknown]],
            Mcs
        >,
        options: GuardedPersistOptions<T, U>,
    ) =>
        persist(initializer, guardOptions(reporter, options)) as StateCreator<
            T,
            Mps,
            [['zustand/persist', unknown], ...Mcs]
        >
