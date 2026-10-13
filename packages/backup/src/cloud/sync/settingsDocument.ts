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

import {
    BACKUP_SETTINGS_FIELDS,
    type BackupSettings,
    type BackupSettingsField,
    type SettingsBackupPayload,
    type SettingsDocument,
    type SettingsFieldState,
} from '../models'
import { canonicalJson, contentHash } from './canonicalize'

type FieldState<K extends BackupSettingsField> = SettingsFieldState<
    BackupSettings[K]
>

const setField = <K extends BackupSettingsField>(
    doc: SettingsDocument,
    field: K,
    state: FieldState<K>,
): void => {
    ;(doc as Record<K, FieldState<K>>)[field] = state
}

const getField = <K extends BackupSettingsField>(
    doc: SettingsDocument | undefined,
    field: K,
): FieldState<K> | undefined =>
    (doc as Record<K, FieldState<K> | undefined> | undefined)?.[field]

/** Only a value that moved since it was last observed is an edit (stamped
 *  `now`). A first sighting is stamped 0, so an untouched default never
 *  outranks another device's choice. */
export const observeLocalSettings = (
    doc: SettingsDocument | undefined,
    local: BackupSettings,
    now: number,
): { doc: SettingsDocument; hasChanged: boolean } => {
    const next: SettingsDocument = {}
    let hasChanged = false

    const observe = <K extends BackupSettingsField>(field: K): void => {
        const current = getField(doc, field)
        const value = local[field]
        const observed = canonicalJson(value)

        if (current === undefined) {
            setField(next, field, { value, updatedAt: 0, observed })
            hasChanged = true
        } else if (current.observed === null) {
            setField(next, field, { ...current, observed })
        } else if (current.observed !== observed) {
            setField(next, field, { value, updatedAt: now, observed })
            hasChanged = true
        } else {
            setField(next, field, current)
        }
    }

    BACKUP_SETTINGS_FIELDS.forEach(observe)
    return { doc: next, hasChanged }
}

/** Per-field last-write-wins; a tie goes to the remote, as for every other
 *  item type. `isRemoteBehind` means the merge kept something the server
 *  lacks, so the item has to be pushed back. */
export const mergeRemoteSettings = (
    doc: SettingsDocument | undefined,
    remote: SettingsBackupPayload,
): {
    doc: SettingsDocument
    toApply: Partial<BackupSettings>
    isRemoteBehind: boolean
} => {
    const next: SettingsDocument = {}
    const toApply: Partial<BackupSettings> = {}
    let isRemoteBehind = false

    const merge = <K extends BackupSettingsField>(field: K): void => {
        const mine = getField(doc, field)
        const theirs = remote[field] as
            | { value: BackupSettings[K]; updatedAt: number }
            | undefined

        if (theirs === undefined) {
            if (mine === undefined) return
            setField(next, field, mine)
            isRemoteBehind = true
            return
        }

        if (mine !== undefined && mine.updatedAt > theirs.updatedAt) {
            setField(next, field, mine)
            isRemoteBehind = true
            return
        }

        const isNewValue =
            mine === undefined ||
            canonicalJson(mine.value) !== canonicalJson(theirs.value)
        setField(next, field, {
            value: theirs.value,
            updatedAt: theirs.updatedAt,
            // Re-observed after the import, so the imported value is not
            // mistaken for a local edit on the next reconcile.
            observed: isNewValue ? null : mine.observed,
        })
        if (isNewValue) toApply[field] = theirs.value
    }

    BACKUP_SETTINGS_FIELDS.forEach(merge)
    return { doc: next, toApply, isRemoteBehind }
}

export const settingsDocumentToPayload = (
    doc: SettingsDocument,
): SettingsBackupPayload => {
    const payload: Record<string, { value: unknown; updatedAt: number }> = {}
    for (const field of BACKUP_SETTINGS_FIELDS) {
        const state = getField(doc, field)
        if (state === undefined) continue
        payload[field] = { value: state.value, updatedAt: state.updatedAt }
    }
    return payload as SettingsBackupPayload
}

/** Stands in for `localContentHash`, which for every other type is the hash of
 *  the local payload; the settings payload is the document itself. */
export const settingsDocumentHash = (doc: SettingsDocument): string =>
    contentHash(canonicalJson(settingsDocumentToPayload(doc)))
