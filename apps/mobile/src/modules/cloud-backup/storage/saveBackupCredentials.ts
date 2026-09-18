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
    NoBackupCredentialsError,
    backupCredentialsFileName,
    buildBackupCredentialsFile,
    useCloudBackupStore,
} from '@perawallet/wallet-core-backup'

import { saveToDevice } from './saveToDevice'
import { saveToGoogleDrive } from './saveToGoogleDrive'
import { saveToICloud } from './saveToICloud'
import type {
    CredentialsFileSaver,
    CredentialsFileSource,
    SaveResult,
} from './types'

const SAVERS: Record<CredentialsFileSource, CredentialsFileSaver> = {
    device: saveToDevice,
    icloud: saveToICloud,
    googleDrive: saveToGoogleDrive,
}

/**
 * Writes the current backup's key file to `destination`. Reads the store at
 * call time, so a backup deleted while a sheet or PIN was open stops here
 * rather than saving a stale key.
 */
export const saveBackupCredentials = async (
    destination: CredentialsFileSource,
): Promise<SaveResult> => {
    const { salt, backupId } = useCloudBackupStore.getState()
    if (!salt || !backupId) throw new NoBackupCredentialsError()

    // Named after the backup, so storing a second one sits beside the first
    // instead of overwriting it.
    return SAVERS[destination](
        backupCredentialsFileName(backupId),
        buildBackupCredentialsFile(salt),
    )
}
