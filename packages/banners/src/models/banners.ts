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

import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'

export const BANNER_TYPES = [
    'generic',
    'governance',
    'staking',
    'card',
    'retail',
] as const

export type BannerType = (typeof BANNER_TYPES)[number]

export const BANNER_AUTO_OPEN_MODES = ['select', 'force'] as const

export type BannerAutoOpenMode = (typeof BANNER_AUTO_OPEN_MODES)[number]

export type Banner = {
    id: number
    type: BannerType
    title: Nullable<string>
    subtitle: Nullable<string>
    buttonLabel: Nullable<string>
    buttonUrl: Nullable<string>
    isButtonUrlExternal: boolean
    // 'select' → auto-open the carousel focused on this banner.
    // 'force'  → only this banner is shown and it cannot be dismissed.
    autoOpenMode: Nullable<BannerAutoOpenMode>
    // Optional override for the type-default background art rendered on the
    // expanded banner card.
    backgroundImageUrl: Nullable<string>
}

export type SpotBanner = {
    id: number
    text: string
    imageUrl: string
    url: string
    isUrlExternal: boolean
}

export type BannersState = BaseStoreState & {
    dismissedBannerIds: number[]
    // Session-only: tracks banners we've already auto-opened the carousel for
    // so we don't bounce the user back into the modal after they close it.
    // Resets on app launch.
    autoOpenedBannerIds: number[]
    dismissBanner: (id: number) => void
    isBannerDismissed: (id: number) => boolean
    markAutoOpened: (id: number) => void
    hasAutoOpened: (id: number) => boolean
}
