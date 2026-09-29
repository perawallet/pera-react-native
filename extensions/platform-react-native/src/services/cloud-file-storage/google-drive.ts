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
    CloudStorageErrorCode,
    type CloudStorage,
} from 'react-native-cloud-storage'

import { resolveCandidate, type ResolvedCandidate } from './candidates'
import { hasCode } from './cloud-storage-error'
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

const BACKUP_FOLDER = '/Pera Wallet'

// Another device winning the folder-creation race is a success, not a failure.
const ensureBackupFolder = async (drive: CloudStorage): Promise<void> => {
    try {
        await drive.mkdir(BACKUP_FOLDER)
    } catch (error) {
        if (!hasCode(error, CloudStorageErrorCode.FILE_ALREADY_EXISTS))
            throw error
    }
}

// Writing first keeps the steady state to one round trip. Two racing
// first-saves can still each create a folder here; Drive resolves a path to
// one folder without ordering, so a duplicate can hide a real backup.
const writeToFolder = async (
    drive: CloudStorage,
    fileName: string,
    contents: string,
): Promise<void> => {
    const path = `${BACKUP_FOLDER}/${fileName}`
    try {
        await drive.writeFile(path, contents)
    } catch (error) {
        if (!hasCode(error, CloudStorageErrorCode.DIRECTORY_NOT_FOUND))
            throw error
        await ensureBackupFolder(drive)
        await drive.writeFile(path, contents)
    }
}

export const saveToGoogleDrive = async (
    fileName: string,
    contents: string,
): Promise<CloudFileSaveResult> => {
    const result = await runOnGoogleDrive(drive =>
        writeToFolder(drive, fileName, toAsciiEscaped(contents)),
    )
    return result.status === 'cancelled' ? 'cancelled' : 'saved'
}

const isFileNotFound = (error: unknown): boolean =>
    hasCode(error, CloudStorageErrorCode.FILE_NOT_FOUND)

const readCandidate = async (
    drive: CloudStorage,
    fileName: string,
): Promise<string> => {
    try {
        return await drive.readFile(`${BACKUP_FOLDER}/${fileName}`)
    } catch (error) {
        // The listing just proved the file or its folder was there, so this is
        // a mid-session delete of either — still "nothing of ours here".
        if (isFileNotFound(error))
            throw new CloudFileNotFoundError('googleDrive')
        throw error
    }
}

const probeEntry = async (
    drive: CloudStorage,
    fileName: string,
    maxBytes: number,
): Promise<string | null> => {
    const path = `${BACKUP_FOLDER}/${fileName}`
    const { size } = await drive.stat(path)
    return size > maxBytes ? null : drive.readFile(path)
}

// The library reports a missing directory as FILE_NOT_FOUND, so a folder no
// first save has created yet is an empty listing rather than a storage error.
const listBackupFolder = async (drive: CloudStorage): Promise<string[]> => {
    try {
        return await drive.readdir(BACKUP_FOLDER)
    } catch (error) {
        if (isFileNotFound(error)) return []
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
    let resolved: ResolvedCandidate | null = null

    const result = await runOnGoogleDrive(async drive => {
        const candidate =
            resolved ??
            (await resolveCandidate(
                await listBackupFolder(drive),
                'googleDrive',
                options,
                (fileName, maxBytes) => probeEntry(drive, fileName, maxBytes),
            ))
        if (candidate === null) return DRIVE_CANCELLED
        if (resolved === null) {
            resolved = candidate
            // Nothing but the read is left, so a progress overlay can no
            // longer collide with the picker or the sign-in sheet.
            options.onReading?.()
        }
        if (candidate.contents !== undefined) return candidate.contents
        return readCandidate(drive, candidate.fileName)
    })

    return result.status === 'cancelled'
        ? result
        : { status: 'read', contents: result.value }
}
