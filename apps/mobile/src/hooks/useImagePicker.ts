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

import { useCallback } from 'react'
import * as ImagePicker from 'expo-image-picker'

export type UseImagePickerResult = {
    pickFromGallery: () => Promise<string | null>
}

/**
 * Returns a URI for an image the user picks from their photo library via the
 * system photo picker (Android photo picker / iOS PHPicker). The picker needs
 * no media-library permission and only ever returns the single asset the user
 * chose, so the app doesn't request READ_MEDIA_IMAGES — which Google Play gates
 * under its Photo & Video Permissions policy. No permission prompt to handle.
 */
export const useImagePicker = (): UseImagePickerResult => {
    const pickFromGallery = useCallback(async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            // Strip EXIF — avatars should not leak GPS/camera metadata.
            exif: false,
        })
        if (result.canceled) {
            return null
        }
        return result.assets[0]?.uri ?? null
    }, [])

    return { pickFromGallery }
}
