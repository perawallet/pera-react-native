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

import { CSV_MIME_TYPE } from '@perawallet/wallet-core-transactions'

/**
 * Web/extension twin of `shareCsvFile`. There's no filesystem or native share
 * sheet in a browser context, so instead this builds a `Blob` from the CSV
 * string and triggers a standard browser download via a temporary,
 * off-DOM anchor element with a `download` attribute.
 */
export const shareCsvFile = async (
    filename: string,
    csvContent: string,
): Promise<void> => {
    const blob = new Blob([csvContent], { type: CSV_MIME_TYPE })
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
