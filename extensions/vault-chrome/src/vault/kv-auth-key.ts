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

import { hkdf } from '@noble/hashes/hkdf.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { base64 } from '@scure/base'
import {
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { PRF_BLOB_KEY, VAULT_STORAGE_KEY } from '../storage-keys'
import { isMarkedSalt } from './marked-salt'

const KV_AUTH_INFO = utf8ToBytes('pera-kv-record-auth-v1')

// Separate from the master key so the contexts that never hold the master key
// (the service worker's relay, the offscreen document) can still verify
// records without being able to decrypt anything.
export const deriveKvAuthKey = (masterKey: Uint8Array): Uint8Array =>
    hkdf(sha256, masterKey, undefined, KV_AUTH_INFO, 32)

/**
 * Seals the records that predate the KV authentication. Receives the key
 * derived from the master key, and rejects if any record could not be sealed.
 */
export type UnlockOptions = {
    migrateLegacyRecords?: (kvAuthKey: Uint8Array) => Promise<void>
}

const readSaltField = (raw: unknown, field: string): Optional<Uint8Array> => {
    if (typeof raw !== 'string') return undefined
    try {
        const parsed: unknown = JSON.parse(raw)
        const value = (parsed as Nullable<Record<string, unknown>>)?.[field]
        return typeof value === 'string' ? base64.decode(value) : undefined
    } catch {
        return undefined
    }
}

export type OtherBlobState = 'absent' | 'unmarked' | 'marked' | 'unreadable'

/**
 * Each unlock method's blob carries its own mark, so one method's migration
 * must close the other's: otherwise deleting or corrupting the blob the user
 * migrated with, or simply turning passkey unlock off, would leave the other
 * blob unmarked and open a second window. An absent blob says nothing:
 * password-only vaults have no PRF blob.
 */
export const readOtherBlobState = async (
    unlockedWith: 'password' | 'passkey',
): Promise<OtherBlobState> => {
    const [storageKey, field] =
        unlockedWith === 'password'
            ? [PRF_BLOB_KEY, 'hkdfSalt']
            : [VAULT_STORAGE_KEY, 'salt']
    const stored = await chrome.storage.local.get(storageKey)
    const raw: unknown = stored[storageKey]
    if (raw === undefined) return 'absent'
    const salt = readSaltField(raw, field)
    if (salt === undefined) return 'unreadable'
    return isMarkedSalt(salt) ? 'marked' : 'unmarked'
}

/** An unreadable blob closes the window but is not a mark to copy: it may be corrupt, not migrated. */
export const isMigrationClosed = (other: OtherBlobState): boolean =>
    other === 'marked' || other === 'unreadable'

/**
 * Callers decide whether this unlock is the one allowed to migrate.
 * Best-effort: a failure returns false, which leaves the blob unmarked so the
 * next unlock retries, and the unlock itself still succeeds.
 */
export const runLegacyRecordMigration = async (
    masterKey: Uint8Array,
    options: Optional<UnlockOptions>,
): Promise<boolean> => {
    if (!options?.migrateLegacyRecords) return false
    const kvAuthKey = deriveKvAuthKey(masterKey)
    try {
        await options.migrateLegacyRecords(kvAuthKey)
        return true
    } catch (error) {
        logger.error('[vault] sealing the legacy network records failed', {
            reason: error instanceof Error ? error.name : 'unknown',
        })
        return false
    } finally {
        kvAuthKey.fill(0)
    }
}
