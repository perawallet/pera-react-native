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
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import type { UnlockOptions } from './migration-window'

const KV_AUTH_INFO = utf8ToBytes('pera-kv-record-auth-v1')

// Separate from the master key so the contexts that never hold the master key
// (the service worker's relay, the offscreen document) can still verify
// records without being able to decrypt anything.
export const deriveKvAuthKey = (masterKey: Uint8Array): Uint8Array =>
    hkdf(sha256, masterKey, undefined, KV_AUTH_INFO, 32)

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
