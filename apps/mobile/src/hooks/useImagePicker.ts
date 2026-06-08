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

import { useCallback, useMemo, useState } from 'react'
import { Linking } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

export type PermissionDeniedState = {
    isVisible: boolean
    close: () => void
    openSettings: () => void
}

export type UseImagePickerResult = {
    pickFromGallery: () => Promise<string | null>
    /**
     * State + handlers for the "permission denied and not re-askable" bottom
     * sheet. Pair with `<PhotoPermissionDeniedSheet />` at the screen root.
     */
    permissionDenied: PermissionDeniedState
}

/**
 * Returns a URI for an image the user picks from their photo library.
 * Handles the iOS/Android permission prompt. When permission has been
 * denied permanently, surfaces a `permissionDenied` state the caller
 * renders via `PhotoPermissionDeniedSheet`.
 */
export const useImagePicker = (): UseImagePickerResult => {
    const [permissionDeniedVisible, setPermissionDeniedVisible] =
        useState(false)

    const closePermissionDenied = useCallback(
        () => setPermissionDeniedVisible(false),
        [],
    )
    const openSettings = useCallback(() => {
        setPermissionDeniedVisible(false)
        void Linking.openSettings()
    }, [])

    const ensurePermission = useCallback(async () => {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync()
        if (current.granted) {
            return true
        }
        if (!current.canAskAgain) {
            setPermissionDeniedVisible(true)
            return false
        }
        const next = await ImagePicker.requestMediaLibraryPermissionsAsync()
        return next.granted
    }, [])

    const pickFromGallery = useCallback(async () => {
        const granted = await ensurePermission()
        if (!granted) {
            return null
        }
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
    }, [ensurePermission])

    const permissionDenied = useMemo<PermissionDeniedState>(
        () => ({
            isVisible: permissionDeniedVisible,
            close: closePermissionDenied,
            openSettings,
        }),
        [permissionDeniedVisible, closePermissionDenied, openSettings],
    )

    return { pickFromGallery, permissionDenied }
}
