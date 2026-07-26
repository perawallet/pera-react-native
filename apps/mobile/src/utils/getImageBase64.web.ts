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

/**
 * Web/extension twin of `getImageBase64`. expo-file-system's `File`/`Paths`
 * API is a native-only no-op stub on web (every method just warns and
 * resolves undefined — see node_modules/expo-file-system/src/
 * ExpoFileSystem.web.ts), so `File.downloadFileAsync` never actually fetches
 * anything there. Fetch the bytes directly instead and hand back the same
 * base64 shape, so `Clipboard.setImageAsync` (which DOES have a working web
 * implementation, backed by `navigator.clipboard.write`) doesn't need to
 * know the difference. `cacheKey` is unused on web — there's no cache file.
 */
export const getImageBase64 = async (
    imageUrl: string,
    _cacheKey: string,
): Promise<string> => {
    const response = await fetch(imageUrl)
    if (!response.ok) {
        throw new Error(`Failed to fetch image (${response.status})`)
    }
    const blob = await response.blob()
    return blobToBase64(blob)
}

const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            const result = reader.result
            if (typeof result !== 'string') {
                reject(new Error('Failed to read image data'))
                return
            }
            // Strip the "data:image/png;base64," prefix FileReader adds.
            resolve(result.slice(result.indexOf(',') + 1))
        }
        reader.onerror = () =>
            reject(reader.error ?? new Error('Failed to read image data'))
        reader.readAsDataURL(blob)
    })
