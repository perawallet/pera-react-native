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
import { InvalidCredentialsFileError } from '@perawallet/wallet-core-backup'
import { File } from 'expo-file-system'
import { readFromDevice } from '../readFromDevice'

const CONTENTS = '{"t":"backup-credentials"}'

beforeEach(() => {
    vi.clearAllMocks()
})

describe('readFromDevice', () => {
    test('refuses a large file without reading it', async () => {
        const text = vi.fn()
        vi.mocked(File.pickFileAsync).mockResolvedValueOnce({
            canceled: false,
            result: { size: 16 * 1024 + 1, text },
        } as never)

        await expect(readFromDevice()).rejects.toBeInstanceOf(
            InvalidCredentialsFileError,
        )
        expect(text).not.toHaveBeenCalled()
    })

    test('returns the text of the file the user picks', async () => {
        vi.mocked(File.pickFileAsync).mockResolvedValueOnce({
            canceled: false,
            result: { size: CONTENTS.length, text: async () => CONTENTS },
        } as never)

        await expect(readFromDevice()).resolves.toEqual({
            status: 'read',
            contents: CONTENTS,
        })
    })

    test('offers JSON however the file provider labels it', async () => {
        vi.mocked(File.pickFileAsync).mockResolvedValueOnce({
            canceled: true,
            result: null,
        } as never)

        await readFromDevice()

        expect(File.pickFileAsync).toHaveBeenCalledWith({
            mimeTypes: [
                'application/json',
                'text/plain',
                'application/octet-stream',
            ],
        })
    })

    test('resolves cancelled when the picker is dismissed', async () => {
        vi.mocked(File.pickFileAsync).mockResolvedValueOnce({
            canceled: true,
            result: null,
        } as never)

        await expect(readFromDevice()).resolves.toEqual({
            status: 'cancelled',
        })
    })

    test('rethrows a failed read of the picked file', async () => {
        vi.mocked(File.pickFileAsync).mockResolvedValueOnce({
            canceled: false,
            result: {
                size: 0,
                text: () => Promise.reject(new Error('permission revoked')),
            },
        } as never)

        await expect(readFromDevice()).rejects.toThrow('permission revoked')
    })
})
