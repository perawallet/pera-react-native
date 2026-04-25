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

/**
 * `address` is the primary key. Two contacts cannot share the same
 * address — `addContact` and `editContact` enforce this and throw
 * `DuplicateAddressError`.
 */
export type Contact = {
    name: string
    address: string
    image?: string
    nfd?: string
}

export type ContactsState = BaseStoreState & {
    contacts: Contact[]
    selectedContact: Nullable<Contact>
    setSelectedContact: (contact: Nullable<Contact>) => void
    /**
     * Insert a new contact. Throws `DuplicateAddressError` if a contact
     * already exists at `contact.address`.
     */
    addContact: (contact: Contact) => boolean
    /**
     * Update the row at `previousAddress` with `contact`. Replaces the
     * row regardless of which fields changed. Throws
     * `DuplicateAddressError` if `contact.address` differs from
     * `previousAddress` and is already used by another contact, and
     * `ContactNotFoundError` if no contact exists at `previousAddress`.
     */
    editContact: (previousAddress: string, contact: Contact) => boolean
    deleteContact: (contact: Contact) => boolean
}
