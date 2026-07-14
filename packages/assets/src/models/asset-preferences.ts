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

import type { BaseStoreState } from '@perawallet/wallet-core-shared'

export const AssetSortModes = {
    balanceDesc: 'balanceDesc',
    balanceAsc: 'balanceAsc',
    alphabeticalAsc: 'alphabeticalAsc',
    alphabeticalDesc: 'alphabeticalDesc',
} as const

export type AssetSortMode = (typeof AssetSortModes)[keyof typeof AssetSortModes]

export type AssetPreferencesState = BaseStoreState & {
    assetSortMode: AssetSortMode
    hideZeroBalance: boolean
    displayNfts: boolean
    displayOptedInNfts: boolean
    setAssetSortMode: (mode: AssetSortMode) => void
    setHideZeroBalance: (hide: boolean) => void
    setDisplayNfts: (display: boolean) => void
    setDisplayOptedInNfts: (display: boolean) => void
}
