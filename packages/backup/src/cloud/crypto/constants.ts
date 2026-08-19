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

import type { Argon2idConfig } from '../models'

/**
 * Canonical Argon2id parameters for backup master-key derivation. These are
 * the agreed cross-platform values and MUST stay fixed — changing any value
 * produces a different master key, breaking interop and restore for existing
 * backups.
 *
 * `memoryCost` is expressed in **MiB** (matching the helper payload field
 * `memory_cost`); the Argon2id primitive consumes KiB, so callers convert.
 */
export const ARGON2ID_CONFIG: Argon2idConfig = {
    timeCost: 3,
    memoryCost: 256,
    parallelism: 1,
    outputLength: 32,
}

/** HKDF `info` label for the symmetric payload-encryption key (`K_enc`). */
export const HKDF_INFO_ENCRYPTION = 'backup-encryption-key'

/** HKDF `info` label for the authentication seed (`K_auth_seed`). */
export const HKDF_INFO_AUTH_SEED = 'backup-auth-seed'

/** DID prefix for the backup identifier: `did:pera:<base64 auth public key>`. */
export const BACKUP_ID_PREFIX = 'did:pera:'

/**
 * AEAD cipher for backup item payloads. MUST stay fixed and identical across
 * encrypt/decrypt and platforms — changing it breaks decryption of existing
 * backups.
 */
export const BACKUP_CIPHER_ALGORITHM = 'aes-256-gcm'
