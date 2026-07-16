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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type {
    DisplayableAsset,
    PeraAsset,
} from '@perawallet/wallet-core-assets'

export const SEARCH_SCOPES = ['accounts', 'contacts', 'assets'] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]

export type GlobalSearchResults = {
    accounts: WalletAccount[]
    contacts: Contact[]
    assets: PeraAsset[]
    remoteAssets: DisplayableAsset[]
}

export const EMPTY_GLOBAL_SEARCH_RESULTS: GlobalSearchResults = {
    accounts: [],
    contacts: [],
    assets: [],
    remoteAssets: [],
}
