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

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import Share from 'react-native-share'
import { shareFile } from '../shareFile'

const { stagedFile } = vi.hoisted(() => ({
    stagedFile: {
        uri: 'file:///cache/report.csv',
        exists: true,
        create: vi.fn(),
        write: vi.fn(),
        delete: vi.fn(),
    },
}))

vi.mock('expo-file-system', () => ({
    File: vi.fn().mockImplementation(function FileMock(this: unknown) {
        Object.assign(this as object, stagedFile)
    }),
    Paths: { cache: { uri: 'file:///cache' } },
}))

vi.mock('react-native-share', () => ({
    default: { open: vi.fn() },
}))

const FILE_NAME = 'report.csv'
const CONTENTS = 'a,b,c'
const MIME_TYPE = 'text/csv'

const shareCancelled = () =>
    Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' })

describe('shareFile', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stagedFile.exists = true
        vi.mocked(Share.open).mockResolvedValue({ success: true, message: '' })
    })

    it('stages the contents in a cache file and shares it with its name and type', async () => {
        await expect(
            shareFile(FILE_NAME, CONTENTS, { mimeType: MIME_TYPE }),
        ).resolves.toBe('shared')

        expect(stagedFile.create).toHaveBeenCalledWith({ overwrite: true })
        expect(stagedFile.write).toHaveBeenCalledWith(CONTENTS)
        expect(Share.open).toHaveBeenCalledWith({
            url: stagedFile.uri,
            filename: FILE_NAME,
            type: MIME_TYPE,
            saveToFiles: false,
            failOnCancel: false,
        })
    })

    it('resolves cancelled when the share sheet is dismissed', async () => {
        vi.mocked(Share.open).mockResolvedValueOnce({
            success: false,
            message: '',
            dismissedAction: true,
        })

        await expect(
            shareFile(FILE_NAME, CONTENTS, { mimeType: MIME_TYPE }),
        ).resolves.toBe('cancelled')
    })

    it('keeps the staged file after a share-sheet share, which the target app may still be reading', async () => {
        await shareFile(FILE_NAME, CONTENTS, { mimeType: MIME_TYPE })

        expect(stagedFile.delete).not.toHaveBeenCalled()
    })

    describe('with saveToFiles', () => {
        const options = { mimeType: MIME_TYPE, saveToFiles: true }

        it('removes the staged copy once Save to Files completes', async () => {
            await expect(shareFile(FILE_NAME, CONTENTS, options)).resolves.toBe(
                'shared',
            )

            expect(Share.open).toHaveBeenCalledWith(
                expect.objectContaining({ saveToFiles: true }),
            )
            expect(stagedFile.delete).toHaveBeenCalled()
        })

        it('resolves cancelled and removes the staged copy when Save to Files is dismissed', async () => {
            vi.mocked(Share.open).mockRejectedValueOnce(shareCancelled())

            await expect(shareFile(FILE_NAME, CONTENTS, options)).resolves.toBe(
                'cancelled',
            )
            expect(stagedFile.delete).toHaveBeenCalled()
        })

        it('rethrows any other failure and still removes the staged copy', async () => {
            vi.mocked(Share.open).mockRejectedValueOnce(
                new Error('Presentation failed'),
            )

            await expect(
                shareFile(FILE_NAME, CONTENTS, options),
            ).rejects.toThrow('Presentation failed')
            expect(stagedFile.delete).toHaveBeenCalled()
        })

        it('skips the delete when the staged copy is already gone', async () => {
            stagedFile.exists = false

            await expect(shareFile(FILE_NAME, CONTENTS, options)).resolves.toBe(
                'shared',
            )
            expect(stagedFile.delete).not.toHaveBeenCalled()
        })
    })
})
