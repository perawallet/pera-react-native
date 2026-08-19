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
    commitSecret,
    removeSecret,
    withSecret,
} from '@perawallet/wallet-core-kms'
import type { Nullable } from '@perawallet/wallet-core-shared'

export const CLOUD_BACKUP_ENC_KEY_ID = 'cloud-backup/k-enc'
export const CLOUD_BACKUP_AUTH_KEY_ID = 'cloud-backup/k-auth-priv'
export const CLOUD_BACKUP_MNEMONIC_ID = 'cloud-backup/mnemonic'

type PersistBackupKeysParams = {
    encryptionKey: Uint8Array
    authSecretKey: Uint8Array
    mnemonic: string[]
}

export const persistBackupKeys = async ({
    encryptionKey,
    authSecretKey,
    mnemonic,
}: PersistBackupKeysParams): Promise<void> => {
    await commitSecret({ id: CLOUD_BACKUP_ENC_KEY_ID, bytes: encryptionKey })
    try {
        await commitSecret({
            id: CLOUD_BACKUP_AUTH_KEY_ID,
            bytes: authSecretKey,
        })
        const mnemonicBytes = new TextEncoder().encode(mnemonic.join(' '))
        await commitSecret({
            id: CLOUD_BACKUP_MNEMONIC_ID,
            bytes: mnemonicBytes,
        })
    } catch (error) {
        await removeSecret(CLOUD_BACKUP_ENC_KEY_ID)
        await removeSecret(CLOUD_BACKUP_AUTH_KEY_ID)
        throw error
    }
}

export const withBackupMnemonic = async <T>(
    handler: (words: string[]) => T | Promise<T>,
): Promise<Nullable<T>> =>
    withSecret(CLOUD_BACKUP_MNEMONIC_ID, bytes =>
        handler(new TextDecoder().decode(bytes).split(' ')),
    )

export const withBackupAuthSecretKey = async <T>(
    handler: (bytes: Uint8Array) => T | Promise<T>,
): Promise<Nullable<T>> => withSecret(CLOUD_BACKUP_AUTH_KEY_ID, handler)

export const withBackupEncryptionKey = async <T>(
    handler: (bytes: Uint8Array) => T | Promise<T>,
): Promise<Nullable<T>> => withSecret(CLOUD_BACKUP_ENC_KEY_ID, handler)

export const deleteBackupKeys = async (): Promise<void> => {
    const results = await Promise.allSettled([
        removeSecret(CLOUD_BACKUP_ENC_KEY_ID),
        removeSecret(CLOUD_BACKUP_AUTH_KEY_ID),
        removeSecret(CLOUD_BACKUP_MNEMONIC_ID),
    ])

    const firstFailure = results.find(result => result.status === 'rejected')
    if (firstFailure?.status === 'rejected') {
        throw firstFailure.reason
    }
}
