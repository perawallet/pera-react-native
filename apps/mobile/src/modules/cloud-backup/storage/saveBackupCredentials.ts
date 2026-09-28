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
    backupCredentialsFileName,
    buildBackupCredentialsFile,
} from '@perawallet/wallet-core-backup'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { saveToDevice } from './saveToDevice'
import type {
    BackupCredentials,
    CredentialsFileSource,
    SaveResult,
} from './types'

// Named after the backup, so storing a second one sits beside the first
// instead of overwriting it.
export const saveCredentialsFile = (
    destination: CredentialsFileSource,
    { salt, backupId }: BackupCredentials,
): Promise<SaveResult> => {
    const fileName = backupCredentialsFileName(backupId)
    const contents = buildBackupCredentialsFile(salt)

    return destination === 'device'
        ? saveToDevice(fileName, contents)
        : getProvider().cloudFileStorage.save(destination, fileName, contents)
}
