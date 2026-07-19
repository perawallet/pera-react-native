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
import { File } from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library/legacy'
import { saveImageToDevice } from '../saveImageToDevice'
import { MediaPermissionDeniedError } from '../mediaErrors'

const mockFileInstance = {
    uri: 'file:///cache/collectible_12345.png',
}

vi.mock('expo-file-system', () => ({
    File: vi.fn().mockImplementation(function FileMock(this: unknown) {
        Object.assign(this as object, mockFileInstance)
    }),
    Paths: { cache: { uri: 'file:///cache' } },
}))

vi.mock('expo-media-library/legacy', () => ({
    requestPermissionsAsync: vi.fn(),
    saveToLibraryAsync: vi.fn(),
}))

describe('saveImageToDevice', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({
            status: 'granted',
        } as never)
        vi.mocked(File).downloadFileAsync = vi
            .fn()
            .mockResolvedValue(mockFileInstance)
    })

    it('requests write-only gallery permission, downloads the file, then saves it', async () => {
        await saveImageToDevice(
            'https://example.com/full.png',
            'collectible_12345.png',
        )

        expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true)
        expect(vi.mocked(File).downloadFileAsync).toHaveBeenCalledWith(
            'https://example.com/full.png',
            expect.any(Object),
            { idempotent: true },
        )
        expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledWith(
            'file:///cache/collectible_12345.png',
        )
    })

    it('throws MediaPermissionDeniedError and never downloads when permission is denied', async () => {
        vi.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({
            status: 'denied',
        } as never)

        await expect(
            saveImageToDevice('https://example.com/full.png', 'file.png'),
        ).rejects.toThrow(MediaPermissionDeniedError)

        expect(vi.mocked(File).downloadFileAsync).not.toHaveBeenCalled()
        expect(MediaLibrary.saveToLibraryAsync).not.toHaveBeenCalled()
    })
})
