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

/**
 * True when the other unlock method's blob already closed the migration, or
 * is present but unreadable. Each blob carries its own mark, so without this
 * a profile writer could delete or corrupt the unlock method the user just
 * migrated with and make the other, still-unmarked blob open a second window.
 * An absent blob says nothing: password-only vaults have no PRF blob.
 */
export const isMigrationClosedByOtherBlob = async (
    unlockedWith: 'password' | 'passkey',
): Promise<boolean> => {
    const [storageKey, field] =
        unlockedWith === 'password'
            ? [PRF_BLOB_KEY, 'hkdfSalt']
            : [VAULT_STORAGE_KEY, 'salt']
    const stored = await chrome.storage.local.get(storageKey)
    const raw: unknown = stored[storageKey]
    if (raw === undefined) return false
    const salt = readSaltField(raw, field)
    return salt === undefined || isMarkedSalt(salt)
}

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
