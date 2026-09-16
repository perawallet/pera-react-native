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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
    CloudStorageError,
    CloudStorageErrorCode,
} from 'react-native-cloud-storage'
import { CredentialsFileNotFoundError } from '../errors'
import { readFromGoogleDrive } from '../readFromGoogleDrive'

const { runOnGoogleDrive, readFile, signOutOfGoogleDrive } = vi.hoisted(() => ({
    runOnGoogleDrive: vi.fn(),
    readFile: vi.fn(),
    signOutOfGoogleDrive: vi.fn(),
}))

vi.mock('../googleDriveSession', () => ({
    runOnGoogleDrive,
    signOutOfGoogleDrive,
}))

const FILE_NAME = 'pera-backup-encryption-key.json'
const CONTENTS = '{"t":"backup-credentials"}'

beforeEach(() => {
    vi.clearAllMocks()
    runOnGoogleDrive.mockImplementation(
        async (
            operation: (drive: unknown) => Promise<unknown>,
            onAuthorized?: () => void,
        ) => {
            onAuthorized?.()
            return { status: 'done', value: await operation({ readFile }) }
        },
    )
    readFile.mockResolvedValue(CONTENTS)
    signOutOfGoogleDrive.mockResolvedValue(null)
})

describe('readFromGoogleDrive', () => {
    test('reads the file from the app-data folder', async () => {
        await expect(readFromGoogleDrive(FILE_NAME)).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
        expect(readFile).toHaveBeenCalledWith(`/${FILE_NAME}`)
        expect(signOutOfGoogleDrive).not.toHaveBeenCalled()
    })

    test('forwards onReading to the session as onAuthorized', async () => {
        const onReading = vi.fn()

        await readFromGoogleDrive(FILE_NAME, onReading)

        expect(runOnGoogleDrive).toHaveBeenCalledWith(
            expect.any(Function),
            onReading,
        )
    })

    test('resolves cancelled when the user backs out of sign-in', async () => {
        runOnGoogleDrive.mockResolvedValueOnce({ status: 'cancelled' })

        await expect(readFromGoogleDrive(FILE_NAME)).resolves.toEqual({
            status: 'cancelled',
        })
        expect(signOutOfGoogleDrive).not.toHaveBeenCalled()
    })

    test('reports a Drive without the file as not found, and signs out so the next attempt can pick another account', async () => {
        readFile.mockRejectedValueOnce(
            new CloudStorageError(
                'File not found',
                CloudStorageErrorCode.FILE_NOT_FOUND,
            ),
        )

        await expect(readFromGoogleDrive(FILE_NAME)).rejects.toBeInstanceOf(
            CredentialsFileNotFoundError,
        )
        expect(signOutOfGoogleDrive).toHaveBeenCalled()
    })

    test('still reports not found when the sign-out itself fails', async () => {
        readFile.mockRejectedValueOnce(
            new CloudStorageError(
                'File not found',
                CloudStorageErrorCode.FILE_NOT_FOUND,
            ),
        )
        signOutOfGoogleDrive.mockRejectedValueOnce(new Error('network'))

        await expect(readFromGoogleDrive(FILE_NAME)).rejects.toBeInstanceOf(
            CredentialsFileNotFoundError,
        )
    })

    test('rethrows any other failure', async () => {
        readFile.mockRejectedValueOnce(new Error('network'))

        await expect(readFromGoogleDrive(FILE_NAME)).rejects.toThrow('network')
        expect(signOutOfGoogleDrive).not.toHaveBeenCalled()
    })
})
