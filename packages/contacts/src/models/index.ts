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

/** Two contacts may hold the same address: devices that saved one person
 *  separately each back up their own contact, and sync keeps both. */
export type Contact = {
    /** Never changes, and names the contact's backup record. */
    id: string
    name: string
    addresses: ContactAddresses
    image?: string
    nfd?: string
}

export type NewContact = Omit<Contact, 'id'> & { id?: string }

export type ContactsState = BaseStoreState & {
    contacts: Contact[]
    selectedContact: Nullable<Contact>
    setSelectedContact: (contact: Nullable<Contact>) => void
    /** Returns false, adding nothing, when it holds no address. A contact
     *  without an `id` is given a new one. */
    addContact: (contact: NewContact) => boolean
    /**
     * Replace the row `id` names, keeping its id; returns false, changing
     * nothing, when `contact` holds no address. Throws `ContactNotFoundError`
     * if no contact has `id`.
     */
    editContact: (id: string, contact: NewContact) => boolean
    deleteContact: (id: string) => boolean
}
