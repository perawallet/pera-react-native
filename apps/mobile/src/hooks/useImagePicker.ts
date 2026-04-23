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
import { Alert, Linking } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

import { useLanguage } from '@hooks/useLanguage'

export type UseImagePickerResult = {
    pickFromGallery: () => Promise<string | null>
}

/**
 * Returns a URI for an image the user picks from their photo library.
 * Handles the iOS/Android permission prompt and guides the user to
 * Settings if they've denied access.
 */
export const useImagePicker = (): UseImagePickerResult => {
    const { t } = useLanguage()

    const ensurePermission = useCallback(async () => {
        const current = await ImagePicker.getMediaLibraryPermissionsAsync()
        if (current.granted) {
            return true
        }
        if (!current.canAskAgain) {
            Alert.alert(
                t('image_picker.permission_title'),
                t('image_picker.permission_body'),
                [
                    { text: t('common.cancel.label'), style: 'cancel' },
                    {
                        text: t('image_picker.open_settings.label'),
                        onPress: () => Linking.openSettings(),
                    },
                ],
            )
            return false
        }
        const next = await ImagePicker.requestMediaLibraryPermissionsAsync()
        return next.granted
    }, [t])

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

    return { pickFromGallery }
}
