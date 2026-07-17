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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Share from 'react-native-share'
import { File } from 'expo-file-system'
import { shareCsvFile } from '../shareCsvFile'

const mockFileInstance = {
    uri: 'file:///cache/test.csv',
    create: vi.fn(),
    write: vi.fn(),
}

vi.mock('expo-file-system', () => ({
    File: vi.fn().mockImplementation(function FileMock(this: unknown) {
        Object.assign(this as object, mockFileInstance)
    }),
    Paths: { cache: { uri: 'file:///cache' } },
}))

vi.mock('react-native-share', () => ({
    default: { open: vi.fn() },
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    CSV_MIME_TYPE: 'text/csv',
}))

describe('shareCsvFile', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('writes CSV content to a cache file with overwrite', async () => {
        await shareCsvFile('tx.csv', 'a,b,c')

        expect(File).toHaveBeenCalledTimes(1)
        expect(mockFileInstance.create).toHaveBeenCalledWith({
            overwrite: true,
        })
        expect(mockFileInstance.write).toHaveBeenCalledWith('a,b,c')
    })

    it('shares the file via react-native-share with the CSV mime type', async () => {
        await shareCsvFile('tx.csv', 'data')

        expect(Share.open).toHaveBeenCalledWith({
            url: 'file:///cache/test.csv',
            filename: 'tx.csv',
            type: 'text/csv',
            failOnCancel: false,
        })
    })
})
