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
 * Web/extension twin of `saveImageToDevice` (same technique as
 * shareCsvFile.web.ts). There's no filesystem or MediaLibrary on the web —
 * expo-media-library ships no web build at all, and expo-file-system's
 * File/Paths API is a native-only no-op stub there — so instead this fetches
 * the media bytes into a `Blob` and triggers a standard browser download via
 * a temporary, off-DOM anchor element with a `download` attribute. There's
 * no permission step on web; the browser's own download UI is the gate.
 */
export const saveImageToDevice = async (
    url: string,
    filename: string,
): Promise<void> => {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch media (${response.status})`)
    }
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)

    try {
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = filename
        anchor.click()
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}
