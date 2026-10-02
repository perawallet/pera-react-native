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

import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import type { BaseStoreState, Nullable } from '@perawallet/wallet-core-shared'

export type ContactAddresses = Partial<Record<ChainFamily, string>>

/** Identifies one contact: an address is unique within its family. */
export type ContactRef = {
    family: ChainFamily
    address: string
}

/**
 * Two contacts cannot hold the same address under the same family;
 * `addContact` and `editContact` enforce this and throw
 * `DuplicateAddressError`. The same string under different families is
 * allowed.
 */
export type Contact = {
    name: string
    addresses: ContactAddresses
    image?: string
    nfd?: string
}

export type ContactsState = BaseStoreState & {
    contacts: Contact[]
    selectedContact: Nullable<Contact>
    setSelectedContact: (contact: Nullable<Contact>) => void
    /**
     * Insert a new contact; returns false, adding nothing, when it holds no
     * address. Throws `DuplicateAddressError` if another contact already
     * holds one of its addresses in the same family.
     */
    addContact: (contact: Contact) => boolean
    /**
     * Replace the row `previous` identifies with `contact`, regardless of
     * which fields changed; returns false, changing nothing, when `contact`
     * holds no address. Throws `DuplicateAddressError` if another
     * contact holds one of `contact`'s addresses in the same family, and
     * `ContactNotFoundError` if no contact matches `previous`.
     */
    editContact: (previous: ContactRef, contact: Contact) => boolean
    /** Removes the row sharing any family address with `contact`. */
    deleteContact: (contact: Contact) => boolean
}
