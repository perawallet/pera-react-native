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
    isBackupCredentialsFileName,
    parseBackupCredentialsFile,
    type BackupEncryptionKey,
} from '@perawallet/wallet-core-backup'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { readFromDevice } from './readFromDevice'
import type {
    ChooseCredentialsFile,
    CredentialsFileSource,
    ReadResult,
} from './types'

export type ReadBackupCredentialsResult =
    | { status: 'read'; key: BackupEncryptionKey }
    | { status: 'cancelled' }

export type ReadBackupCredentialsOptions = {
    onReading?: () => void
    /** A folder can hold a key per backup, so every cloud read may need to ask.
     *  Required: with no chooser the read can only report a cancel, which the
     *  caller cannot tell from the user dismissing it. */
    chooseFile: ChooseCredentialsFile
    signal?: AbortSignal
}

const readFrom = (
    source: CredentialsFileSource,
    { onReading, chooseFile, signal }: ReadBackupCredentialsOptions,
): Promise<ReadResult> =>
    // The device picker names the file itself, so it needs neither the
    // candidate filter nor the chooser.
    source === 'device'
        ? readFromDevice()
        : getProvider().cloudFileStorage.read(source, {
              isCandidate: isBackupCredentialsFileName,
              chooseFile,
              onReading,
              signal,
          })

export const readBackupCredentials = async (
    source: CredentialsFileSource,
    options: ReadBackupCredentialsOptions,
): Promise<ReadBackupCredentialsResult> => {
    const read = await readFrom(source, options)
    if (read.status === 'cancelled') return read
    // The parser throws the same typed errors this layer used to translate into.
    return { status: 'read', key: parseBackupCredentialsFile(read.contents) }
}
