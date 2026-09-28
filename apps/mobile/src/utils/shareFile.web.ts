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

import type { ShareFileOptions, ShareFileResult } from './shareFile'

// The extension has no filesystem or share sheet, so this is a browser
// download, and the browser reports no cancel.
export const shareFile = async (
    fileName: string,
    contents: string | Uint8Array<ArrayBuffer>,
    { mimeType }: ShareFileOptions,
): Promise<ShareFileResult> => {
    const objectUrl = URL.createObjectURL(
        new Blob([contents], { type: mimeType }),
    )
    try {
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = fileName
        anchor.click()
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
    return 'shared'
}
