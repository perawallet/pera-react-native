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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as ImagePicker from 'expo-image-picker'
import { useImagePicker } from '../useImagePicker'

// Only the system photo picker is mocked. The hook requests no media-library
// permission, so if it tried to, the (undefined) permission fns would throw —
// these tests passing is itself proof the permission path is gone.
vi.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: vi.fn(),
}))

describe('useImagePicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens the system photo picker and returns the picked URI', async () => {
        vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///tmp/photo.jpg' }],
        } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>)

        const { result } = renderHook(() => useImagePicker())
        const uri = await result.current.pickFromGallery()

        expect(uri).toBe('file:///tmp/photo.jpg')
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1)
    })

    it('returns null when the user cancels the picker', async () => {
        vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
            canceled: true,
        } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>)

        const { result } = renderHook(() => useImagePicker())

        expect(await result.current.pickFromGallery()).toBeNull()
    })
})
