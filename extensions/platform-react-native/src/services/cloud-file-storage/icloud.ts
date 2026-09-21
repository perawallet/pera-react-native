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
    CloudFileNotDownloadedError,
    ICloudNotConfiguredError,
    ICloudUnavailableError,
    type CloudFileReadResult,
    type CloudFileSaveResult,
    type ReadCloudFileOptions,
} from '@perawallet/wallet-extension-platform'
import {
    CloudStorage,
    CloudStorageError,
    CloudStorageErrorCode,
    CloudStorageProvider,
    CloudStorageScope,
} from 'react-native-cloud-storage'

import { resolveCandidate } from './candidates'

// 20 × 500 ms of sleeping is the floor of the wait, not its ceiling: each
// attempt also makes a triggerSync and a read round trip, neither of which is
// bounded here.
const POLL_INTERVAL_MS = 500
const POLL_ATTEMPTS = 20

const hasCode = (error: unknown, code: CloudStorageErrorCode): boolean =>
    error instanceof CloudStorageError && error.code === code

// Past the availability check this means no container for this app: the build
// lacks the entitlement, or iCloud Drive is switched off for Pera. Telling the
// user to sign in would be a dead end in both.
const throwIfContainerMissing = (error: unknown): void => {
    if (hasCode(error, CloudStorageErrorCode.DIRECTORY_NOT_FOUND)) {
        throw new ICloudNotConfiguredError()
    }
}

// AppData is the container root, hidden from the Files app: the file is for the
// app to read back on restore, not for the user to move around.
const openICloud = (): CloudStorage =>
    new CloudStorage(CloudStorageProvider.ICloud, {
        scope: CloudStorageScope.AppData,
    })

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
    new Promise(resolve => {
        const stop = (): void => {
            clearTimeout(timer)
            signal?.removeEventListener('abort', stop)
            resolve()
        }
        const timer = setTimeout(stop, ms)
        signal?.addEventListener('abort', stop, { once: true })
    })

export const saveToICloud = async (
    fileName: string,
    contents: string,
): Promise<CloudFileSaveResult> => {
    const iCloud = openICloud()
    if (!(await iCloud.isCloudAvailable())) throw new ICloudUnavailableError()
    try {
        await iCloud.writeFile(`/${fileName}`, contents)
    } catch (error) {
        throwIfContainerMissing(error)
        throw error
    }
    return 'saved'
}

const listEntries = async (iCloud: CloudStorage): Promise<string[]> => {
    try {
        // An undownloaded file still lists; only reading it has to wait for the
        // download, which readFromICloud polls for.
        return await iCloud.readdir('/')
    } catch (error) {
        throwIfContainerMissing(error)
        throw error
    }
}

const readIfPresent = async (
    iCloud: CloudStorage,
    path: string,
): Promise<string | null> => {
    try {
        return await iCloud.readFile(path)
    } catch (error) {
        throwIfContainerMissing(error)
        if (hasCode(error, CloudStorageErrorCode.FILE_NOT_FOUND)) return null
        // iOS 18.4+ can list an undownloaded file as present and fail the read
        // instead, so this is what a download in progress looks like there. The
        // library exposes no download state to tell that from an unreadable
        // file, and a slow download is by far the likelier of the two.
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
const readWhenDownloaded = async (
    iCloud: CloudStorage,
    path: string,
    signal?: AbortSignal,
): Promise<CloudFileReadResult> => {
    const contents = await readIfPresent(iCloud, path)
    if (contents !== null) return { status: 'read', contents }

    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        if (signal?.aborted) return { status: 'cancelled' }
        await startDownload(iCloud, path)
        await wait(POLL_INTERVAL_MS, signal)
        if (signal?.aborted) return { status: 'cancelled' }
        const downloaded = await readIfPresent(iCloud, path)
        if (downloaded !== null) return { status: 'read', contents: downloaded }
    }
    throw new CloudFileNotDownloadedError()
}

// Listing and reading share one container handle, which costs nothing here but
// keeps the shape the Drive store has to have and fires `onReading` once.
export const readFromICloud = async (
    options: ReadCloudFileOptions,
): Promise<CloudFileReadResult> => {
    const iCloud = openICloud()
    if (!(await iCloud.isCloudAvailable())) throw new ICloudUnavailableError()

    const fileName = await resolveCandidate(
        await listEntries(iCloud),
        'icloud',
        options,
    )
    if (fileName === null) return { status: 'cancelled' }

    // Nothing but the read is left, so a progress overlay can no longer
    // collide with the picker.
    options.onReading?.()
    return readWhenDownloaded(iCloud, `/${fileName}`, options.signal)
}
