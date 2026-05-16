/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/** Required QR action; Rejects anything else with `unsupported_action`. */
export const PERA_WEB_QR_ACTION_IMPORT = 'import'

/**
 * Required QR protocol version. Stays "1" until the Pera Web export format
 * changes. Rejects mismatches with `unsupported_version`.
 */
export const PERA_WEB_QR_SUPPORTED_VERSION = '1'

/**
 * Decoded shape of a single QR code from Pera Web. Both legacy clients keep
 * the fields shallow; iOS reads optional `version`/`action`/`modificationKey`
 * fields while Android only requires `backupId`+`encryptionKey`. We accept
 * either superset and validate version/action when present.
 */
export type PeraWebQrPayload = {
    /** Server-side id of the encrypted backup row (UUID-shaped in practice). */
    backupId: string
    /** Symmetric secretbox key bytes (decoded from the on-wire encoding). */
    encryptionKey: Uint8Array
}

/**
 * Raw HTTP shape returned by `GET /v1/backups/{id}/`. Field naming matches the
 * Django serializer, hence the snake_case. The interesting payload is
 * `encrypted_content` — base64 of `nonce(24) || ciphertext_with_mac`.
 */
export type PeraWebBackupResponse = {
    id: string | null
    type: string | null
    encrypted_content: string | null
    creator_device: string | null
}

/**
 * Per-account row inside the decrypted backup JSON. Matches the Android
 * `BackupTransferAccountElement` shape; iOS uses `AccountImportParameters` with
 * the same field set. `accountType` is informational ("single"/"watch"/etc.)
 * and we don't dispatch on it — see `parseAccount` for the parsing rules.
 *
 * `privateKey` is the raw 32-byte Ed25519 seed for single accounts (null for
 * watch). Pera Web exports the seed, not the full 64-byte tweetnacl secret key
 * (unlike ASB).
 */
export type PeraWebBackupAccount = {
    address: string
    name: string | null
    accountType: string | null
    privateKey: Uint8Array | null
    metadata: string | null
}

export type PeraWebBackupPayload = {
    accounts: PeraWebBackupAccount[]
}
