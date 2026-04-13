/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Platform, Share } from 'react-native'
import { File } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { shareCsvFile } from '../shareCsvFile'

const mockFileInstance = {
    uri: 'file:///cache/test.csv',
    create: vi.fn(),
    write: vi.fn(),
}

vi.mock('react-native', () => ({
    Platform: { OS: 'ios' },
    Share: { share: vi.fn() },
}))

vi.mock('expo-file-system', () => ({
    File: vi.fn().mockImplementation(function FileMock(this: unknown) {
        Object.assign(this as object, mockFileInstance)
    }),
    Paths: { cache: { uri: 'file:///cache' } },
}))

vi.mock('expo-sharing', () => ({
    isAvailableAsync: vi.fn(),
    shareAsync: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    CSV_MIME_TYPE: 'text/csv',
}))

describe('shareCsvFile', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(Platform as { OS: string }).OS = 'ios'
    })

    it('writes CSV content to a cache file with overwrite', async () => {
        await shareCsvFile('tx.csv', 'a,b,c')

        expect(File).toHaveBeenCalledTimes(1)
        expect(mockFileInstance.create).toHaveBeenCalledWith({
            overwrite: true,
        })
        expect(mockFileInstance.write).toHaveBeenCalledWith('a,b,c')
    })

    it('uses react-native Share with the file URI on iOS', async () => {
        ;(Platform as { OS: string }).OS = 'ios'

        await shareCsvFile('tx.csv', 'data')

        expect(Share.share).toHaveBeenCalledWith({
            url: 'file:///cache/test.csv',
            title: 'tx.csv',
        })
        expect(Sharing.shareAsync).not.toHaveBeenCalled()
    })

    it('uses expo-sharing shareAsync on Android', async () => {
        ;(Platform as { OS: string }).OS = 'android'
        vi.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(true)

        await shareCsvFile('tx.csv', 'data')

        expect(Sharing.isAvailableAsync).toHaveBeenCalled()
        expect(Sharing.shareAsync).toHaveBeenCalledWith(
            'file:///cache/test.csv',
            expect.objectContaining({
                mimeType: 'text/csv',
                dialogTitle: 'tx.csv',
            }),
        )
        expect(Share.share).not.toHaveBeenCalled()
    })

    it('throws when sharing is unavailable on Android', async () => {
        ;(Platform as { OS: string }).OS = 'android'
        vi.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false)

        await expect(shareCsvFile('tx.csv', 'data')).rejects.toThrow(
            /not available/i,
        )
        expect(Sharing.shareAsync).not.toHaveBeenCalled()
    })
})
