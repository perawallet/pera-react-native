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

import { CHAIN_FAMILIES } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { ContactAddresses } from './models'

/** The id given to a contact saved before contacts had ids: its first address
 *  in `CHAIN_FAMILIES` order. Every device derives the same one, so two that
 *  already share the contact back up one record rather than a copy each. A new
 *  contact gets a random id, and no id is ever re-derived after an edit. */
export const derivedContactId = (
    addresses: ContactAddresses,
): Nullable<string> => {
    const family = CHAIN_FAMILIES.find(each => addresses[each])
    return family ? `${family}:${addresses[family]}` : null
}
