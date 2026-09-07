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
import {
    ARGON2ID_CONFIG,
    HKDF_INFO_AUTH_SEED,
    HKDF_INFO_ENCRYPTION,
} from './constants'

export type BackupChildKeys = {
    /** Symmetric AES key for payload encryption (`K_enc`). */
    encryptionKey: Uint8Array
    /** Seed for the deterministic Ed25519 auth keypair (`K_auth_seed`). */
    authSeed: Uint8Array
}

const EMPTY_SALT = new Uint8Array(0)

// HKDF info must stay the UTF-8 bytes of these exact labels: any other
// encoding derives different keys and orphans every backup already written.
const ENCRYPTION_INFO = utf8ToBytes(HKDF_INFO_ENCRYPTION)
const AUTH_SEED_INFO = utf8ToBytes(HKDF_INFO_AUTH_SEED)

/**
 * Derives the backup child keys (`K_enc`, `K_auth_seed`) from the backup master
 * key via HKDF-SHA256 with distinct info labels.
 */
export const deriveBackupChildKeys = (
    masterKey: Uint8Array,
): BackupChildKeys => {
    const length = ARGON2ID_CONFIG.outputLength
    const encryptionKey = hkdf(
        sha256,
        masterKey,
        EMPTY_SALT,
        ENCRYPTION_INFO,
        length,
    )
    const authSeed = hkdf(sha256, masterKey, EMPTY_SALT, AUTH_SEED_INFO, length)
    return { encryptionKey, authSeed }
}
