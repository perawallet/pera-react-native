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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { File } from 'expo-file-system'
import { usePickBackupFile } from '../usePickBackupFile'

describe('usePickBackupFile (native default)', () => {
    beforeEach(() => {
        vi.mocked(File.pickFileAsync).mockReset()
    })

    it('returns the picked file name and contents', async () => {
        vi.mocked(File.pickFileAsync).mockResolvedValueOnce({
            name: 'backup.txt',
            text: async () => 'envelope-contents',
        } as never)

        const { result } = renderHook(() => usePickBackupFile())
        const file = await result.current.pickFile()

        expect(file).toEqual({
            name: 'backup.txt',
            contents: 'envelope-contents',
        })
    })

    it('resolves null when the picker rejects with a cancellation error', async () => {
        vi.mocked(File.pickFileAsync).mockRejectedValueOnce(
            new Error('FilePickingCancelledException'),
        )

        const { result } = renderHook(() => usePickBackupFile())
        const file = await result.current.pickFile()

        expect(file).toBeNull()
    })

    it('resolves null when the picker resolves with no file', async () => {
        vi.mocked(File.pickFileAsync).mockResolvedValueOnce(undefined as never)

        const { result } = renderHook(() => usePickBackupFile())
        const file = await result.current.pickFile()

        expect(file).toBeNull()
    })

    it('rethrows a non-cancellation error so the caller can surface it', async () => {
        vi.mocked(File.pickFileAsync).mockRejectedValueOnce(
            new Error('disk read failed'),
        )

        const { result } = renderHook(() => usePickBackupFile())

        await expect(result.current.pickFile()).rejects.toThrow(
            'disk read failed',
        )
    })
})
