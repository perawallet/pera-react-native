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
    CloudFileNotFoundError,
    type CloudFileReadResult,
    type CloudFileSaveResult,
    type ReadCloudFileOptions,
} from '@perawallet/wallet-extension-platform'
import {
    CloudStorageError,
    CloudStorageErrorCode,
    type CloudStorage,
} from 'react-native-cloud-storage'

import { resolveCandidate } from './candidates'
import { DRIVE_CANCELLED, runOnGoogleDrive } from './google-drive-session'

export { isGoogleDriveConfigured } from './google-drive-session'

// react-native-cloud-storage sends `body.length` as Content-Length (see its
// storages/google-drive/client.ts), which counts UTF-16 units rather than UTF-8
// bytes, so one accented character is enough for Drive to truncate the upload.
// Escaping to ASCII makes the two counts agree. It is safe only because every
// file in this folder is JSON, where a \u escape inside a string literal parses
// back to the same character — so the workaround lives with the transport that
// needs it, not in the format the other stores share.
const toAsciiEscaped = (contents: string): string =>
    contents.replace(
        /[\u007f-\uffff]/g,
        char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
    )

export const saveToGoogleDrive = async (
    fileName: string,
    contents: string,
): Promise<CloudFileSaveResult> => {
    const result = await runOnGoogleDrive(drive =>
        drive.writeFile(`/${fileName}`, toAsciiEscaped(contents)),
    )
    return result.status === 'cancelled' ? 'cancelled' : 'saved'
}

const isFileNotFound = (error: unknown): boolean =>
    error instanceof CloudStorageError &&
    error.code === CloudStorageErrorCode.FILE_NOT_FOUND

const readCandidate = async (
    drive: CloudStorage,
    fileName: string,
): Promise<string> => {
    try {
        return await drive.readFile(`/${fileName}`)
    } catch (error) {
        // The listing a moment ago proved it was there, so this is a file
        // removed mid-session — still "nothing of ours in this account".
        if (isFileNotFound(error))
            throw new CloudFileNotFoundError('googleDrive')
        throw error
    }
}

export const readFromGoogleDrive = async (
    options: ReadCloudFileOptions,
): Promise<CloudFileReadResult> => {
    // Listing and reading share one session, so the user signs in once. The
    // session re-runs its operation after a rejected token, so the resolved
    // name is kept out here and reused: prompting `chooseFile` twice would be
    // the regression the single session is meant to remove.
    let resolved: string | null = null

    const result = await runOnGoogleDrive(async drive => {
        const fileName =
            resolved ??
            (await resolveCandidate(
                await drive.readdir('/'),
                'googleDrive',
                options,
            ))
        if (fileName === null) return DRIVE_CANCELLED
        if (resolved === null) {
            resolved = fileName
            // Nothing but the read is left, so a progress overlay can no
            // longer collide with the picker or the sign-in sheet.
            options.onReading?.()
        }
        return readCandidate(drive, fileName)
    })

    return result.status === 'cancelled'
        ? result
        : { status: 'read', contents: result.value }
}
