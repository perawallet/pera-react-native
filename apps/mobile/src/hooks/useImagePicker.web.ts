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

import { useCallback } from 'react'
import * as ImagePicker from 'expo-image-picker'
import type { UseImagePickerResult } from './useImagePicker'

/**
 * Web twin. `expo-image-picker`'s web backend hands back `uri` as a
 * `URL.createObjectURL()` blob URL scoped to the current document — nothing
 * durable backs it. The blob stops resolving the moment the tab/popup
 * unloads, so a contact avatar saved as a blob URL "disappears" (broken
 * image) the next time the popup reopens or the page reloads, even though
 * the string itself round-tripped through the persisted store correctly.
 * Requesting `base64` instead and storing a `data:` URL keeps the image
 * bytes inline in the string, so it survives JSON serialization and reload.
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
            base64: true,
        })
        if (result.canceled) {
            return null
        }
        const asset = result.assets[0]
        if (!asset?.base64) {
            return null
        }
        const mimeType = asset.mimeType ?? 'image/jpeg'
        return `data:${mimeType};base64,${asset.base64}`
    }, [])

    return { pickFromGallery }
}
