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

import { File, Paths } from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library/legacy'
import { MediaPermissionDeniedError } from './mediaErrors'

/**
 * Downloads a remote media file and saves it to the device gallery.
 *
 * writeOnly: we only save to the gallery, never read it. On Android 13+
 * this needs no runtime permission (scoped MediaStore write), so the app
 * doesn't request READ_MEDIA_IMAGES — which Play gates under its Photo &
 * Video Permissions policy.
 *
 * @throws {MediaPermissionDeniedError} if the user denies the gallery
 * write permission.
 */
export const saveImageToDevice = async (
    url: string,
    filename: string,
): Promise<void> => {
    const { status } = await MediaLibrary.requestPermissionsAsync(true)
    if (status !== 'granted') {
        throw new MediaPermissionDeniedError()
    }

    const dest = new File(Paths.cache, filename)
    const file = await File.downloadFileAsync(url, dest, { idempotent: true })

    await MediaLibrary.saveToLibraryAsync(file.uri)
}
