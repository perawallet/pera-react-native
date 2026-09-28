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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Platform } from 'react-native'
import { shareFile } from '@utils/shareFile'
import { saveToDevice } from '../saveToDevice'

const { pickDirectoryAsync, createFile, writePicked } = vi.hoisted(() => ({
    pickDirectoryAsync: vi.fn(),
    createFile: vi.fn(),
    writePicked: vi.fn(),
}))

vi.mock('expo-file-system', () => ({
    Directory: { pickDirectoryAsync },
}))

vi.mock('@utils/shareFile', () => ({
    shareFile: vi.fn(),
}))

const FILE_NAME = 'pera-backup-encryption-key.json'
const CONTENTS = '{"salt":"q311Z4ReDNWpMVuH8XdvSw=="}'
const originalOS = Platform.OS

beforeEach(() => {
    vi.clearAllMocks()
    createFile.mockReturnValue({ write: writePicked })
    pickDirectoryAsync.mockResolvedValue({ createFile })
})

afterEach(() => {
    Platform.OS = originalOS
})

describe('saveToDevice on Android', () => {
    beforeEach(() => {
        Platform.OS = 'android'
    })

    test('writes the file into the folder the user picks', async () => {
        await expect(saveToDevice(FILE_NAME, CONTENTS)).resolves.toBe('saved')

        expect(createFile).toHaveBeenCalledWith(FILE_NAME, 'application/json')
        expect(writePicked).toHaveBeenCalledWith(CONTENTS)
        expect(shareFile).not.toHaveBeenCalled()
    })

    test('resolves cancelled when the folder picker is dismissed', async () => {
        pickDirectoryAsync.mockRejectedValueOnce(
            new Error(
                "Call to function 'FileSystem.pickDirectoryAsync' has been rejected. Caused by: The file picker was cancelled by the user",
            ),
        )

        await expect(saveToDevice(FILE_NAME, CONTENTS)).resolves.toBe(
            'cancelled',
        )
        expect(createFile).not.toHaveBeenCalled()
    })

    test('rethrows a picker failure that is not a cancel', async () => {
        pickDirectoryAsync.mockRejectedValueOnce(
            new Error('No storage provider'),
        )

        await expect(saveToDevice(FILE_NAME, CONTENTS)).rejects.toThrow(
            'No storage provider',
        )
    })

    // The write happens after the picker returns, so no cancellation check
    // stands between this failure and the caller.
    test('rethrows a write failure even when its message mentions cancelling', async () => {
        writePicked.mockImplementationOnce(() => {
            throw new Error('Operation canceled by the provider')
        })

        await expect(saveToDevice(FILE_NAME, CONTENTS)).rejects.toThrow(
            'Operation canceled by the provider',
        )
    })

    // The picker rejection is the one the cancellation check reads, and a
    // dismissal it misreads would lose the file silently.
    test('rethrows a picker failure that merely mentions cancelling', async () => {
        pickDirectoryAsync.mockRejectedValueOnce(
            new Error('Permission denied; the request was cancelled'),
        )

        await expect(saveToDevice(FILE_NAME, CONTENTS)).rejects.toThrow(
            'Permission denied',
        )
    })
})

describe('saveToDevice on iOS', () => {
    beforeEach(() => {
        Platform.OS = 'ios'
    })

    test.each([
        ['shared', 'saved'],
        ['cancelled', 'cancelled'],
    ] as const)(
        'hands the JSON file to Save to Files and maps %s to %s',
        async (shareResult, saveResult) => {
            vi.mocked(shareFile).mockResolvedValueOnce(shareResult)

            await expect(saveToDevice(FILE_NAME, CONTENTS)).resolves.toBe(
                saveResult,
            )
            expect(shareFile).toHaveBeenCalledWith(FILE_NAME, CONTENTS, {
                mimeType: 'application/json',
                saveToFiles: true,
            })
        },
    )
})
