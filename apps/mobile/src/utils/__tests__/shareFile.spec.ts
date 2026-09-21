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
import { shareFile } from '../shareFile'

const mockFileInstance = {
    uri: 'file:///cache/statement.pdf',
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

describe('shareFile', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('writes binary content to a cache file and shares it with its mime type', async () => {
        const bytes = new Uint8Array([37, 80, 68, 70])

        await shareFile('statement.pdf', bytes, 'application/pdf')

        expect(File).toHaveBeenCalledTimes(1)
        expect(mockFileInstance.create).toHaveBeenCalledWith({
            overwrite: true,
        })
        expect(mockFileInstance.write).toHaveBeenCalledWith(bytes)
        expect(Share.open).toHaveBeenCalledWith({
            url: 'file:///cache/statement.pdf',
            filename: 'statement.pdf',
            type: 'application/pdf',
            failOnCancel: false,
        })
    })

    it('accepts text content too', async () => {
        await shareFile('notes.txt', 'hello', 'text/plain')

        expect(mockFileInstance.write).toHaveBeenCalledWith('hello')
        expect(Share.open).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'text/plain' }),
        )
    })
})
