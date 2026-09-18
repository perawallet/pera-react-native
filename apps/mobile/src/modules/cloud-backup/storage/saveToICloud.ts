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

import { ICloudUnavailableError } from '@perawallet/wallet-core-backup'
import {
    CloudStorage,
    CloudStorageError,
    CloudStorageErrorCode,
    CloudStorageProvider,
    CloudStorageScope,
} from 'react-native-cloud-storage'

import type { SaveResult } from './types'

// AppData is the container root, hidden from the Files app: the file is for the
// app to read back on restore, not for the user to move around.
export const saveToICloud = async (
    fileName: string,
    contents: string,
): Promise<SaveResult> => {
    const iCloud = new CloudStorage(CloudStorageProvider.ICloud, {
        scope: CloudStorageScope.AppData,
    })
    if (!(await iCloud.isCloudAvailable())) throw new ICloudUnavailableError()
    try {
        await iCloud.writeFile(`/${fileName}`, contents)
    } catch (error) {
        // No ubiquity container means iCloud Drive is off for this app, or the
        // build lacks the iCloud entitlement.
        if (
            error instanceof CloudStorageError &&
            error.code === CloudStorageErrorCode.DIRECTORY_NOT_FOUND
        ) {
            throw new ICloudUnavailableError()
        }
        throw error
    }
    return 'saved'
}
