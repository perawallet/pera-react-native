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
    CloudStorageError,
    CloudStorageErrorCode,
} from 'react-native-cloud-storage'

import { CredentialsFileNotFoundError } from './errors'
import { runOnGoogleDrive, signOutOfGoogleDrive } from './googleDriveSession'
import type { ReadResult } from './types'

const isFileNotFound = (error: unknown): boolean =>
    error instanceof CloudStorageError &&
    error.code === CloudStorageErrorCode.FILE_NOT_FOUND

export const readFromGoogleDrive = async (
    fileName: string,
    onReading?: () => void,
): Promise<ReadResult> => {
    try {
        const result = await runOnGoogleDrive(
            drive => drive.readFile(`/${fileName}`),
            onReading,
        )
        return result.status === 'cancelled'
            ? result
            : { status: 'read', contents: result.value }
    } catch (error) {
        if (isFileNotFound(error)) {
            // Sign-in silently reuses the last account; signing out lets the
            // next attempt pick another.
            await signOutOfGoogleDrive().catch(() => undefined)
            throw new CredentialsFileNotFoundError('googleDrive')
        }
        throw error
    }
}
