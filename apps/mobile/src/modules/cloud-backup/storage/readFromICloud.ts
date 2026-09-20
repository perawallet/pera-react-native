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
    CredentialsFileNotDownloadedError,
    ICloudUnavailableError,
} from '@perawallet/wallet-core-backup'
import {
    CloudStorage,
    CloudStorageError,
    CloudStorageErrorCode,
    CloudStorageProvider,
    CloudStorageScope,
} from 'react-native-cloud-storage'

import type { ReadResult } from './types'

const POLL_INTERVAL_MS = 500
// About 10 s for a fresh install to pull the file down.
const POLL_ATTEMPTS = 20

const hasCode = (error: unknown, code: CloudStorageErrorCode): boolean =>
    error instanceof CloudStorageError && error.code === code

const wait = (ms: number): Promise<void> =>
    new Promise(resolve => {
        setTimeout(resolve, ms)
    })

const readIfPresent = async (
    iCloud: CloudStorage,
    path: string,
): Promise<string | null> => {
    try {
        return await iCloud.readFile(path)
    } catch (error) {
        // Same mapping as saveToICloud.
        if (hasCode(error, CloudStorageErrorCode.DIRECTORY_NOT_FOUND)) {
            throw new ICloudUnavailableError()
        }
        if (hasCode(error, CloudStorageErrorCode.FILE_NOT_FOUND)) return null
        // iOS 18.4+ can list an undownloaded file as present and fail the
        // read instead.
        if (hasCode(error, CloudStorageErrorCode.READ_ERROR)) return null
        throw error
    }
}

const startDownload = async (
    iCloud: CloudStorage,
    path: string,
): Promise<void> => {
    try {
        await iCloud.triggerSync(path)
    } catch (error) {
        // A file whose metadata hasn't reached this device isn't ubiquitous
        // yet; the next attempt retries.
        if (!hasCode(error, CloudStorageErrorCode.FILE_NOT_DOWNLOADABLE)) {
            throw error
        }
    }
}

// On a fresh install the file is an undownloaded placeholder, which the library
// reads as not found until the download finishes.
export const readFromICloud = async (
    fileName: string,
    onReading?: () => void,
): Promise<ReadResult> => {
    const iCloud = new CloudStorage(CloudStorageProvider.ICloud, {
        scope: CloudStorageScope.AppData,
    })
    if (!(await iCloud.isCloudAvailable())) throw new ICloudUnavailableError()
    onReading?.()

    const path = `/${fileName}`
    const contents = await readIfPresent(iCloud, path)
    if (contents !== null) return { status: 'read', contents }

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        await startDownload(iCloud, path)
        await wait(POLL_INTERVAL_MS)
        const downloaded = await readIfPresent(iCloud, path)
        if (downloaded !== null) return { status: 'read', contents: downloaded }
    }
    throw new CredentialsFileNotDownloadedError()
}
