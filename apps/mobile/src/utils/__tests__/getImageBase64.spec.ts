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
import { getImageBase64 } from '../getImageBase64'

const mockFileInstance = {
    uri: 'file:///cache/collectible_12345',
    base64: vi.fn().mockResolvedValue('base64data'),
}

vi.mock('expo-file-system', () => ({
    File: vi.fn().mockImplementation(function FileMock(this: unknown) {
        Object.assign(this as object, mockFileInstance)
    }),
    Paths: { cache: { uri: 'file:///cache' } },
}))

describe('getImageBase64', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFileInstance.base64.mockResolvedValue('base64data')
        vi.mocked(File).downloadFileAsync = vi
            .fn()
            .mockResolvedValue(mockFileInstance)
    })

    it('downloads the image into the cache dir and returns its base64 bytes', async () => {
        const result = await getImageBase64(
            'https://example.com/nft.png',
            'collectible_12345',
        )

        expect(File).toHaveBeenCalledTimes(1)
        expect(vi.mocked(File).downloadFileAsync).toHaveBeenCalledWith(
            'https://example.com/nft.png',
            expect.any(Object),
            { idempotent: true },
        )
        expect(result).toBe('base64data')
    })
})
