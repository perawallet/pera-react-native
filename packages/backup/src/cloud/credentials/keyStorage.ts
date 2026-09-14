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
    hasSecret,
    mnemonicWordsToIndices,
    removeSecret,
    withSecret,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import type { Nullable } from '@perawallet/wallet-core-shared'

export class BackupMnemonicParseError extends Error {
    constructor(message = 'Stored backup phrase is not a wordlist phrase') {
        super(message)
        this.name = 'BackupMnemonicParseError'
    }
}

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
    // `commitSecret` zeroes only its own copy, so this buffer is ours to wipe.
    let mnemonicBytes: Uint8Array | null = null
    try {
        await commitSecret({
            id: CLOUD_BACKUP_AUTH_KEY_ID,
            bytes: authSecretKey,
        })
        mnemonicBytes = new TextEncoder().encode(mnemonic.join(' '))
        await commitSecret({
            id: CLOUD_BACKUP_MNEMONIC_ID,
            bytes: mnemonicBytes,
        })
    } catch (error) {
        await removeSecret(CLOUD_BACKUP_ENC_KEY_ID)
        await removeSecret(CLOUD_BACKUP_AUTH_KEY_ID)
        throw error
    } finally {
        zeroBytes(mnemonicBytes)
    }
}

/**
 * `handler` must `.slice()` anything it holds past its own return — the buffer
 * is zeroed afterwards.
 *
 * `null` means nothing is stored; `BackupMnemonicParseError` means something is
 * stored but doesn't decode to a wordlist phrase. Callers must route these apart.
 */
export const withBackupMnemonicIndices = async <T>(
    handler: (indices: Uint16Array) => T | Promise<T>,
): Promise<Nullable<T>> =>
    withSecret<Nullable<T>>(CLOUD_BACKUP_MNEMONIC_ID, async bytes => {
        // The keystore holds UTF-8 text, so words exist for this one expression.
        const indices = mnemonicWordsToIndices(
            new TextDecoder().decode(bytes).split(' '),
        )
        // Safe to throw here: `mnemonicWordsToIndices` zeroes its partial
        // buffer before returning null, so nothing survives the unwind.
        if (!indices) throw new BackupMnemonicParseError()

        try {
            return await handler(indices)
        } finally {
            zeroBytes(indices)
        }
    })

export const withBackupAuthSecretKey = async <T>(
    handler: (bytes: Uint8Array) => T | Promise<T>,
): Promise<Nullable<T>> => withSecret(CLOUD_BACKUP_AUTH_KEY_ID, handler)

export const withBackupEncryptionKey = async <T>(
    handler: (bytes: Uint8Array) => T | Promise<T>,
): Promise<Nullable<T>> => withSecret(CLOUD_BACKUP_ENC_KEY_ID, handler)

export const hasBackupCredentials = (): boolean =>
    hasSecret(CLOUD_BACKUP_AUTH_KEY_ID)

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
