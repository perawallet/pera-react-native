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
 * Web/extension twin of `shareFile`. A browser has neither a filesystem nor a
 * native share sheet, so the content becomes a Blob downloaded through a
 * temporary off-DOM anchor with a `download` attribute.
 */
export const shareFile = async (
    filename: string,
    content: string | Uint8Array<ArrayBuffer>,
    mimeType: string,
): Promise<void> => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        anchor.click()
    } finally {
        URL.revokeObjectURL(url)
    }
}
