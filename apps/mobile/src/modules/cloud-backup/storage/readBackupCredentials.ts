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
    LEGACY_BACKUP_CREDENTIALS_FILE_NAME,
    parseBackupCredentialsFile,
    type BackupEncryptionKey,
} from '@perawallet/wallet-core-backup'

import { listFromGoogleDrive } from './listFromGoogleDrive'
import { listFromICloud } from './listFromICloud'
import { readFromDevice } from './readFromDevice'
import { readFromGoogleDrive } from './readFromGoogleDrive'
import { readFromICloud } from './readFromICloud'
import type {
    ChooseCredentialsFile,
    CredentialsFileLister,
    CredentialsFileReader,
    CredentialsFileSource,
} from './types'

const READERS: Record<CredentialsFileSource, CredentialsFileReader> = {
    device: readFromDevice,
    icloud: readFromICloud,
    googleDrive: readFromGoogleDrive,
}

/** The device picker names its own file, so only the cloud sources list. */
const LISTERS: Record<
    Exclude<CredentialsFileSource, 'device'>,
    CredentialsFileLister
> = {
    icloud: listFromICloud,
    googleDrive: listFromGoogleDrive,
}

export type ReadBackupCredentialsResult =
    | { status: 'read'; key: BackupEncryptionKey }
    | { status: 'cancelled' }

export type ReadBackupCredentialsOptions = {
    onReading?: () => void
    /** Required wherever a folder can hold more than one saved key. */
    chooseFile?: ChooseCredentialsFile
}

type ResolvedFileName =
    | { status: 'resolved'; fileName: string }
    | { status: 'cancelled' }

const resolveFileName = async (
    source: CredentialsFileSource,
    { onReading, chooseFile }: ReadBackupCredentialsOptions,
): Promise<ResolvedFileName> => {
    // The picker names the file, so the value below is never read.
    if (source === 'device') {
        return {
            status: 'resolved',
            fileName: LEGACY_BACKUP_CREDENTIALS_FILE_NAME,
        }
    }

    // An empty folder throws from the lister, which owns the per-source
    // not-found handling (Drive signs out so another account can be picked).
    const listed = await LISTERS[source](onReading)
    if (listed.status === 'cancelled') return listed

    const [only, ...rest] = listed.fileNames
    if (rest.length === 0 && only) return { status: 'resolved', fileName: only }

    const chosen = await chooseFile?.(listed.fileNames)
    return chosen
        ? { status: 'resolved', fileName: chosen }
        : { status: 'cancelled' }
}

export const readBackupCredentials = async (
    source: CredentialsFileSource,
    options: ReadBackupCredentialsOptions = {},
): Promise<ReadBackupCredentialsResult> => {
    const resolved = await resolveFileName(source, options)
    if (resolved.status === 'cancelled') return resolved

    const read = await READERS[source](resolved.fileName, options.onReading)
    if (read.status === 'cancelled') return read
    // The parser throws the same typed errors this layer used to translate into.
    return { status: 'read', key: parseBackupCredentialsFile(read.contents) }
}
