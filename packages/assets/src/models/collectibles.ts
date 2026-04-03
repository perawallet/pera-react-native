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

export const CollectibleMediaType = {
    image: 'image',
    video: 'video',
    audio: 'audio',
    mixed: 'mixed',
    unknown: 'unknown',
} as const

export type CollectibleMediaType =
    (typeof CollectibleMediaType)[keyof typeof CollectibleMediaType]

export const CollectibleStandard = {
    arc3: 'arc3',
    arc69: 'arc69',
} as const

export type CollectibleStandard =
    (typeof CollectibleStandard)[keyof typeof CollectibleStandard]

export type CollectibleMedia = {
    type: CollectibleMediaType
    downloadUrl?: string
    previewUrl?: string
    extension: string
}

export type CollectibleCollection = {
    id?: number
    name: string
    description?: string
}

export type CollectibleTrait = {
    displayName?: string
    displayValue: string
}

export type PeraCollectible = {
    title?: string
    standard?: CollectibleStandard
    primaryImage?: string
    mediaType?: CollectibleMediaType
    explorerUrl?: string
    collection?: CollectibleCollection
    description?: string
    traits?: CollectibleTrait[]
    media?: CollectibleMedia[]
}
