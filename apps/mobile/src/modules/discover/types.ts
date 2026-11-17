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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * The one value type for a dApp row, a favorite input, a `{kind:'dapp'}`
 * recent and an open call. `url` is an https URL that passed
 * `toValidatedBrowserUrl`. It carries no verification state: favorites and
 * recents are persisted, and a stored "verified" would outlive a later
 * downgrade of the project, so verification is joined at render time.
 */
export type DiscoverDapp = {
    url: string
    name: string
    logo: Nullable<string>
    categories: string[]
    chains: ChainId[]
    projectId?: string
}

export type DiscoverFavorite = DiscoverDapp & { addedAt: number }
