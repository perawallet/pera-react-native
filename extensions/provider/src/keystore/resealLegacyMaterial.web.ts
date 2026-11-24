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
    MASTER_KEY_ID,
    MATERIAL_STORE,
    METADATA_STORE,
    open,
    openDatabase,
    seal,
    type KeyStoreDatabase,
    type MaterialRecord,
} from '@algorandfoundation/keystore-web'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { safeWarn } from './migrations/safeLog'
import type {
    LegacyCheckDeps,
    LegacyCheckReport,
    ResealDeps,
    ResealReport,
} from './resealTypes'

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean =>
    a.length === b.length && a.every((value, i) => value === b[i])

const tryOpen = async (
    subtle: SubtleCrypto,
    key: CryptoKey,
    record: Extract<MaterialRecord, { kind: 'bytes' }>,
): Promise<Nullable<Uint8Array>> => {
    try {
        return await open(subtle, key, record)
    } catch {
        // Did not open under this key. With a valid key this is an
        // AES-GCM authentication failure: sealed under a different key.
        return null
    }
}

type BytesRecord = Extract<MaterialRecord, { kind: 'bytes' }>

const resealBytes = async (
    deps: ResealDeps,
    db: KeyStoreDatabase,
    legacyKey: CryptoKey,
    record: BytesRecord,
    report: ResealReport,
): Promise<void> => {
    const { engineKey } = deps
    const alreadyMigrated = await tryOpen(deps.subtle, engineKey, record)
    if (alreadyMigrated) {
        alreadyMigrated.fill(0)
        return
    }
    const plaintext = await tryOpen(deps.subtle, legacyKey, record)
    if (!plaintext) {
        report.unrecoverable.push(record.id)
        safeWarn(`keystore record ${record.id} opens under neither key`)
        return
    }
    try {
        const sealed = await seal(deps.subtle, engineKey, plaintext)
        // A write that lands but cannot be opened would be treated as
        // authoritative by the next run, so prove it before the put.
        const check = await open(deps.subtle, engineKey, sealed)
        const readsBack = bytesEqual(check, plaintext)
        check.fill(0)
        if (!readsBack) {
            throw new Error(`re-sealed ${record.id} does not read back`)
        }
        await db.put<MaterialRecord>(MATERIAL_STORE, {
            id: record.id,
            kind: 'bytes',
            ...sealed,
        })
        report.resealed += 1
    } finally {
        plaintext.fill(0)
    }
}

const remintChild = async (
    deps: LegacyCheckDeps,
    db: KeyStoreDatabase,
    record: Extract<MaterialRecord, { kind: 'cryptokey' }>,
    report: LegacyCheckReport,
): Promise<void> => {
    const key = await db.get<Key>(METADATA_STORE, record.id)
    const parentKeyId = key?.metadata?.parentKeyId
    if (
        !key ||
        !key.publicKey ||
        key.type !== 'ed25519' ||
        typeof parentKeyId !== 'string'
    ) {
        report.unrecoverable.push(record.id)
        safeWarn(
            `keystore child ${record.id} has no parent seed to re-mint from`,
        )
        return
    }
    let seed: unknown
    try {
        seed = (await deps.keystore.export(parentKeyId)).privateKey
    } catch {
        // An unrecoverable parent is a per-record diagnostic, not a reason to
        // abandon the sweep before the legacy key goes.
        report.unrecoverable.push(record.id)
        safeWarn(`keystore seed ${parentKeyId} did not export`)
        return
    }
    if (!(seed instanceof Uint8Array)) {
        report.unrecoverable.push(record.id)
        safeWarn(`keystore seed ${parentKeyId} did not export`)
        return
    }
    const seedBytes = seed
    try {
        // Same id and fields as the original mint. Only `parentKeyId` is
        // carried over: core spreads caller metadata last, so passing the
        // stored `storage: 'cryptokey'` would mislabel the new bytes record.
        // `driver.put` and `addMetadata` both upsert by id, so no `remove`.
        await deps.keystore.import(
            {
                id: record.id,
                type: 'ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                keyUsages: ['sign', 'verify'],
                privateKey: seedBytes,
                publicKey: key.publicKey,
                metadata: { parentKeyId },
            },
            'raw',
        )
        report.reminted += 1
    } catch {
        report.unrecoverable.push(record.id)
        safeWarn(`keystore child ${record.id} did not re-mint`)
    } finally {
        seedBytes.fill(0)
    }
}

// Raw read on purpose: keystore-web's exported `getMasterKey` creates the
// record when absent, which would plant the very key this module looks for.
const readLegacyKey = async (
    db: KeyStoreDatabase,
): Promise<Nullable<CryptoKey>> => {
    const legacy = await db.get<MaterialRecord>(MATERIAL_STORE, MASTER_KEY_ID)
    return legacy?.kind === 'cryptokey' ? legacy.privateKey : null
}

/**
 * Moves a profile written under the driver's auto-generated master key onto
 * the vault-derived engine key, then deletes that key. Only the vault calls it,
 * from an unlock whose blob has not yet recorded a finished re-seal: on any
 * other profile a `__keystore.master__` record is something a profile writer
 * planted, and whatever it opens must not become the user's material.
 *
 * Idempotent: the AES-GCM tag tells the two keys apart, so every write is a
 * valid engine-sealed copy and concurrent runs from two surfaces commute.
 * Rejecting leaves the vault's window open for the next unlock.
 */
export const resealLegacyMaterialWith = async (
    deps: ResealDeps,
): Promise<ResealReport> => {
    const report: ResealReport = {
        resealed: 0,
        unrecoverable: [],
        legacyKeyRemoved: false,
    }
    const db = await openDatabase(deps.databaseName, deps.indexedDB)
    try {
        const legacyKey = await readLegacyKey(db)
        if (!legacyKey) return report
        const records = await db.getAll<MaterialRecord>(MATERIAL_STORE, [
            MASTER_KEY_ID,
        ])
        for (const record of records) {
            if (record.kind === 'bytes') {
                await resealBytes(deps, db, legacyKey, record, report)
            }
        }
        // Everything it could open has been re-sealed; an unrecoverable
        // record is no reason to keep a key that cannot open it either.
        await db.delete(MATERIAL_STORE, MASTER_KEY_ID)
        report.legacyKeyRemoved = true
        return report
    } finally {
        db.close()
    }
}

const reportUnopenable = async (
    deps: LegacyCheckDeps,
    records: MaterialRecord[],
    report: LegacyCheckReport,
): Promise<void> => {
    const engineKey = await deps.resolveEngineKey()
    for (const record of records) {
        if (record.kind !== 'bytes') continue
        const plaintext = await tryOpen(deps.subtle, engineKey, record)
        if (plaintext) {
            plaintext.fill(0)
            continue
        }
        report.unrecoverable.push(record.id)
        safeWarn(
            `keystore record ${record.id} does not open under the vault key`,
        )
    }
}

/**
 * Runs after unlock and never re-seals: only the unlock may, behind the vault's
 * mark. A legacy key found here is not honoured but left in place, so a genuine
 * one survives a failed re-seal for the next unlock to move. Re-minting arms on
 * a leftover `cryptokey` record, so a child that failed once is retried.
 */
export const checkLegacyMaterialWith = async (
    deps: LegacyCheckDeps,
): Promise<LegacyCheckReport> => {
    const report: LegacyCheckReport = { reminted: 0, unrecoverable: [] }
    const db = await openDatabase(deps.databaseName, deps.indexedDB)
    try {
        const legacyKey = await readLegacyKey(db)
        const records = await db.getAll<MaterialRecord>(MATERIAL_STORE, [
            MASTER_KEY_ID,
        ])
        const hasCryptoKeyChild = records.some(
            record => record.kind === 'cryptokey',
        )
        // A fully migrated profile costs one get and one getAll per unlock.
        if (!legacyKey && !hasCryptoKeyChild) return report

        if (legacyKey) {
            safeWarn('keystore legacy key present after unlock; not honoured')
            await reportUnopenable(deps, records, report)
        }
        for (const record of records) {
            if (record.kind === 'cryptokey') {
                await remintChild(deps, db, record, report)
            }
        }
        return report
    } finally {
        db.close()
    }
}
