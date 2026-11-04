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
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

export const SEARCH_SCOPES = ['accounts', 'contacts', 'assets'] as const
export type SearchScope = (typeof SEARCH_SCOPES)[number]

export type AccountSearchResult = {
    account: WalletAccount
    /**
     * The chain whose address the result shows, picked by an address match,
     * then a network-name match, then the network filter; undefined when only
     * the name matched with no filter, so the account shows its own chain.
     */
    chainId: Optional<ChainId>
}

export type AssetSearchResult = {
    asset: PeraAsset
    scope: ChainScope
}

export type GlobalSearchResults = {
    accounts: AccountSearchResult[]
    contacts: Contact[]
    assets: AssetSearchResult[]
}

export const EMPTY_GLOBAL_SEARCH_RESULTS: GlobalSearchResults = {
    accounts: [],
    contacts: [],
    assets: [],
}
