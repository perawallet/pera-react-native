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
    BACKUP_CREDENTIALS_FILE_NAME,
    BackupCredentialsFileError,
    BackupCredentialsFileUnsupportedVersionError,
    parseBackupCredentialsFile,
    type BackupEncryptionKey,
} from '@perawallet/wallet-core-backup'

import {
    InvalidCredentialsFileError,
    UnsupportedCredentialsFileError,
} from './errors'
import { readFromDevice } from './readFromDevice'
import { readFromGoogleDrive } from './readFromGoogleDrive'
import { readFromICloud } from './readFromICloud'
import type { CredentialsFileReader, CredentialsFileSource } from './types'

const READERS: Record<CredentialsFileSource, CredentialsFileReader> = {
    device: readFromDevice,
    icloud: readFromICloud,
    googleDrive: readFromGoogleDrive,
}

export type ReadBackupCredentialsResult =
    | { status: 'read'; key: BackupEncryptionKey }
    | { status: 'cancelled' }

const toAppError = (error: unknown): unknown => {
    if (error instanceof BackupCredentialsFileUnsupportedVersionError) {
        return new UnsupportedCredentialsFileError()
    }
    if (error instanceof BackupCredentialsFileError) {
        return new InvalidCredentialsFileError()
    }
    return error
}

export const readBackupCredentials = async (
    source: CredentialsFileSource,
    onReading?: () => void,
): Promise<ReadBackupCredentialsResult> => {
    const read = await READERS[source](BACKUP_CREDENTIALS_FILE_NAME, onReading)
    if (read.status === 'cancelled') return read
    try {
        return {
            status: 'read',
            key: parseBackupCredentialsFile(read.contents),
        }
    } catch (error) {
        throw toAppError(error)
    }
}
