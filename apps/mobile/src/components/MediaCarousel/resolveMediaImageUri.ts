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

export type MediaItem = {
    type: string
    previewUrl?: string
    downloadUrl?: string
    extension?: string
}

export const resolveMediaImageUri = (
    item?: MediaItem,
    fallbackImageUrl?: string,
): string | undefined => {
    // A model's downloadUrl is the 3D asset, not an inline image.
    if (item?.type === 'model') {
        return item.previewUrl ?? fallbackImageUrl
    }
    // The backend's previewUrl for IPFS-hosted GIFs is a single-frame
    // thumbnail (ipfs-thumbnails → algonode ?optimizer=image); only
    // downloadUrl keeps the animation, so GIFs must prefer it.
    if (item?.extension?.toLowerCase().includes('gif')) {
        return item.downloadUrl ?? item.previewUrl ?? fallbackImageUrl
    }
    return item?.previewUrl ?? item?.downloadUrl ?? fallbackImageUrl
}
