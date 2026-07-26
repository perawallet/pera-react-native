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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ImagePicker from 'expo-image-picker'
import { useImagePicker } from '../useImagePicker.web'

vi.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: vi.fn(),
}))

describe('useImagePicker (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns a data: URL built from the picked asset base64 payload, not the ephemeral blob uri', async () => {
        vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
            canceled: false,
            assets: [
                {
                    uri: 'blob:https://extension-id/1234-5678',
                    base64: 'ZmFrZS1pbWFnZS1ieXRlcw==',
                    mimeType: 'image/png',
                },
            ],
        } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>)

        const { result } = renderHook(() => useImagePicker())
        const uri = await result.current.pickFromGallery()

        expect(uri).toBe('data:image/png;base64,ZmFrZS1pbWFnZS1ieXRlcw==')
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
            expect.objectContaining({ base64: true }),
        )
    })

    it('falls back to image/jpeg when the asset has no mimeType', async () => {
        vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
            canceled: false,
            assets: [
                { uri: 'blob:https://extension-id/abcd', base64: 'abc123' },
            ],
        } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>)

        const { result } = renderHook(() => useImagePicker())
        const uri = await result.current.pickFromGallery()

        expect(uri).toBe('data:image/jpeg;base64,abc123')
    })

    it('returns null when the user cancels the picker', async () => {
        vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
            canceled: true,
        } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>)

        const { result } = renderHook(() => useImagePicker())

        expect(await result.current.pickFromGallery()).toBeNull()
    })

    it('returns null when the picked asset has no base64 payload', async () => {
        vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'blob:https://extension-id/no-base64' }],
        } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>)

        const { result } = renderHook(() => useImagePicker())

        expect(await result.current.pickFromGallery()).toBeNull()
    })
})
