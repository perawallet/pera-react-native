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

import type { GalleryPreviewEntry } from './types'

const registry = new Map<string, GalleryPreviewEntry>()

export const registerPreview = (entry: GalleryPreviewEntry): void => {
    if (registry.has(entry.id)) {
        throw new Error(`Duplicate gallery preview id: ${entry.id}`)
    }
    registry.set(entry.id, entry)
}

export const getPreviewEntry = (id: string): GalleryPreviewEntry | undefined =>
    registry.get(id)

export const resetPreviewRegistry = (): void => registry.clear()
