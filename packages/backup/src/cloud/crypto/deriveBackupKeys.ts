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

import { zeroBytes } from '@perawallet/wallet-core-kms'
import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import type { BackupId } from '../models'
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
}

type DeriveBackupKeysParams = {
    mnemonic: string[]
    /** Base64-encoded salt generated at setup. */
    salt: string
}

export const deriveBackupKeys = async ({
    mnemonic,
    salt,
}: DeriveBackupKeysParams): Promise<BackupKeys> => {
    const password = backupMnemonicToPassword(mnemonic)
    const saltBytes = decodeFromBase64(salt)
    const masterKey = await deriveBackupMasterKey(password, saltBytes)
    zeroBytes(password)

    const { encryptionKey, authSeed } = deriveBackupChildKeys(masterKey)
    zeroBytes(masterKey)

    const { publicKey, secretKey } = deriveBackupAuthKeypair(authSeed)
    zeroBytes(authSeed)

    return {
        backupId: deriveBackupId(publicKey),
        encryptionKey,
        authPublicKey: publicKey,
        authSecretKey: secretKey,
    }
}
