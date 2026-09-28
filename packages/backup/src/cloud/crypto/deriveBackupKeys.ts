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

import { zeroBytes } from '@perawallet/wallet-core-kms'
import type { Argon2idConfig, BackupId } from '../models'
import { decodeBase64Salt } from './argon2idConfig'
import { deriveBackupAuthKeypair } from './deriveBackupAuthKeypair'
import { deriveBackupId } from './deriveBackupId'
import { deriveBackupChildKeys } from './deriveBackupChildKeys'
import { deriveBackupMasterKey } from './deriveBackupMasterKey'
import { backupMnemonicToPassword } from './backupMnemonicToPassword'

export type BackupKeys = {
    backupId: BackupId
    /** Symmetric AES key for payload encryption (`K_enc`). */
    encryptionKey: Uint8Array
    /** Ed25519 auth public key (forms the backupId). */
    authPublicKey: Uint8Array
    /** Ed25519 auth private key (64-byte tweetnacl secret key). */
    authSecretKey: Uint8Array
    /** HMAC key for hashing an address into an item key (`K_item`). */
    itemKey: Uint8Array
}

type DeriveBackupKeysParams = {
    mnemonic: string[]
    /** Base64-encoded salt generated at setup. */
    salt: string
    /** Defaults to this build's `ARGON2ID_CONFIG`; pass the backup's own only
     *  when it travelled alongside the phrase, as it does in a sync QR. */
    argon2id?: Argon2idConfig
}

export const deriveBackupKeys = async ({
    mnemonic,
    salt,
    argon2id,
}: DeriveBackupKeysParams): Promise<BackupKeys> => {
    let password: Uint8Array | null = null
    let masterKey: Uint8Array | null = null
    let authSeed: Uint8Array | null = null
    let encryptionKey: Uint8Array | null = null
    let itemKey: Uint8Array | null = null
    let secretKey: Uint8Array | null = null

    // base64-js maps characters outside the alphabet to zero bytes, so a
    // garbled paste of the right length would otherwise derive a plausible key
    // that opens nothing.
    const saltBytes = decodeBase64Salt(salt)
    if (!saltBytes) throw new Error('Backup salt is not base64')

    try {
        password = backupMnemonicToPassword(mnemonic)
        masterKey = await deriveBackupMasterKey(password, saltBytes, argon2id)
        ;({ encryptionKey, authSeed, itemKey } =
            deriveBackupChildKeys(masterKey))

        const { publicKey, secretKey: authSecretKey } =
            deriveBackupAuthKeypair(authSeed)
        secretKey = authSecretKey

        return {
            backupId: deriveBackupId(publicKey),
            encryptionKey,
            authPublicKey: publicKey,
            authSecretKey: secretKey,
            itemKey,
        }
    } catch (error) {
        zeroBytes(encryptionKey, secretKey, itemKey)
        throw error
    } finally {
        zeroBytes(password, masterKey, authSeed)
    }
}
