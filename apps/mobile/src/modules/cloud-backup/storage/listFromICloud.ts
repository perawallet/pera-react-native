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
    CredentialsFileNotFoundError,
    ICloudUnavailableError,
    isBackupCredentialsFileName,
} from '@perawallet/wallet-core-backup'
import {
    CloudStorage,
    CloudStorageError,
    CloudStorageErrorCode,
    CloudStorageProvider,
    CloudStorageScope,
} from 'react-native-cloud-storage'

import type { ListResult } from './types'

export const listFromICloud = async (
    onListing?: () => void,
): Promise<ListResult> => {
    const iCloud = new CloudStorage(CloudStorageProvider.ICloud, {
        scope: CloudStorageScope.AppData,
    })
    if (!(await iCloud.isCloudAvailable())) throw new ICloudUnavailableError()
    onListing?.()

    let entries: string[]
    try {
        // An undownloaded file still lists; only reading it has to wait for the
        // download, which readFromICloud polls for.
        entries = await iCloud.readdir('/')
    } catch (error) {
        // Same mapping as saveToICloud: no ubiquity container at all.
        if (
            error instanceof CloudStorageError &&
            error.code === CloudStorageErrorCode.DIRECTORY_NOT_FOUND
        ) {
            throw new ICloudUnavailableError()
        }
        throw error
    }

    const fileNames = entries.filter(isBackupCredentialsFileName)
    if (fileNames.length === 0) throw new CredentialsFileNotFoundError('icloud')
    return { status: 'listed', fileNames }
}
