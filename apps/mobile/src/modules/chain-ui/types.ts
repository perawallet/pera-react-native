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

import type {
    ChainFamily,
    I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import type { WrongNetworkAddressCopy } from '@components/AddressSearchView'
import type { AccountOptionsDisplay } from '@modules/accounts'
import type {
    AssetDetailsDisplay,
    CollectibleDetailsDisplay,
} from '@modules/assets'
import type { WatchAccountCopy } from '@modules/onboarding'
import type { CustomNodeDisplay } from '@modules/settings'
import type { TransactionDisplay } from '@modules/signing'
import type { SendConfirmationDisplay } from '@modules/transactions'

/** Each slot's type belongs to its feature, which decides what a missing slot renders. */
export type ChainUi = {
    transactionDetails?: TransactionDisplay
    assetDetails?: AssetDetailsDisplay
    collectibleDetails?: CollectibleDetailsDisplay
    sendConfirmation?: SendConfirmationDisplay
    customNode?: CustomNodeDisplay
    /** The family's name where one address serves every chain in it, as on a contact. */
    familyLabel?: I18nKey
    accountOptions?: AccountOptionsDisplay
    /** Used while this family alone can watch accounts; otherwise the watch flow names no chain. */
    watchAccountCopy?: WatchAccountCopy
    /** Unset, an address of this family entered elsewhere reads as a search miss. */
    wrongNetworkAddress?: WrongNetworkAddressCopy
    /** How the family's wallets import a recovery passphrase; unset, the other-wallets explainer skips the family. */
    passphraseCompatibilityKey?: I18nKey
    /** Unset, the address search uses neutral copy that names no address format. */
    addressSearchPlaceholder?: I18nKey
}

export type ChainUiRegistry = Partial<Record<ChainFamily, ChainUi>>
