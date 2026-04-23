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

vi.mock('expo-image-picker', () => ({
    getMediaLibraryPermissionsAsync: vi.fn(),
    requestMediaLibraryPermissionsAsync: vi.fn(),
    launchImageLibraryAsync: vi.fn(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(() => ({
        t: (key: string) => key,
    })),
}))

describe('useImagePicker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the picked URI when permission is granted and user selects', async () => {
        vi.mocked(
            ImagePicker.getMediaLibraryPermissionsAsync,
        ).mockResolvedValue({
            granted: true,
            canAskAgain: true,
        } as Awaited<
            ReturnType<typeof ImagePicker.getMediaLibraryPermissionsAsync>
        >)
        vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///tmp/photo.jpg' }],
        } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>)

        const { result } = renderHook(() => useImagePicker())
        const uri = await result.current.pickFromGallery()

        expect(uri).toBe('file:///tmp/photo.jpg')
    })

    it('returns null when user cancels the picker', async () => {
        vi.mocked(
            ImagePicker.getMediaLibraryPermissionsAsync,
        ).mockResolvedValue({
            granted: true,
            canAskAgain: true,
        } as Awaited<
            ReturnType<typeof ImagePicker.getMediaLibraryPermissionsAsync>
        >)
        vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
            canceled: true,
        } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>)

        const { result } = renderHook(() => useImagePicker())
        const uri = await result.current.pickFromGallery()

        expect(uri).toBeNull()
    })

    it('returns null when permission is denied and not reprompt-able', async () => {
        vi.mocked(
            ImagePicker.getMediaLibraryPermissionsAsync,
        ).mockResolvedValue({
            granted: false,
            canAskAgain: false,
        } as Awaited<
            ReturnType<typeof ImagePicker.getMediaLibraryPermissionsAsync>
        >)

        const { result } = renderHook(() => useImagePicker())
        const uri = await result.current.pickFromGallery()

        expect(uri).toBeNull()
        expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled()
    })
})
