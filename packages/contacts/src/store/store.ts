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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import type {
    Contact,
    ContactAddresses,
    ContactRef,
    ContactsState,
} from '../models'
import { ContactNotFoundError, DuplicateAddressError } from '../errors'
import {
    registerStore,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'contacts-store'
const STORE_VERSION = 2

type PersistedContactsState = {
    contacts: Contact[]
}

const initialState = {
    contacts: [] as Contact[],
    selectedContact: null as Nullable<Contact>,
}

const addressEntries = (addresses: ContactAddresses) =>
    Object.entries(addresses).filter(
        (entry): entry is [ChainFamily, string] =>
            typeof entry[1] === 'string' && entry[1].length > 0,
    )

// Nothing could ever find an address-less row again to edit or delete it.
const holdsAnyAddress = (contact: Contact): boolean =>
    addressEntries(contact.addresses).length > 0

const findContactIndex = (contacts: Contact[], ref: ContactRef): number =>
    contacts.findIndex(c => c.addresses[ref.family] === ref.address)

const assertNoFamilyConflict = (
    contacts: Contact[],
    addresses: ContactAddresses,
    skipIndex?: number,
): void => {
    for (const [family, address] of addressEntries(addresses)) {
        const conflict = contacts.some(
            (c, idx) => idx !== skipIndex && c.addresses[family] === address,
        )
        if (conflict) throw new DuplicateAddressError({ family, address })
    }
}

type V1Contact = Omit<Contact, 'addresses'> & { address?: unknown }

/**
 * v1 stored a single Algorand `address` per contact. A row without one could
 * never be selected, edited or backed up, so it is dropped.
 */
export const migrateContactsState = (
    persistedState: unknown,
    version: number,
): PersistedContactsState => {
    if (version >= STORE_VERSION) {
        return persistedState as PersistedContactsState
    }
    const { contacts = [] } = persistedState as { contacts?: V1Contact[] }
    return {
        contacts: contacts.flatMap(({ address, ...rest }) =>
            typeof address === 'string' && address.length > 0
                ? [{ ...rest, addresses: { algorand: address } }]
                : [],
        ),
    }
}

export const useContactsStore: UseBoundStore<
    WithPersist<StoreApi<ContactsState>, unknown>
> = create<ContactsState>()(
    persist(
        (set, get) => ({
            ...initialState,
            setSelectedContact: (contact: Nullable<Contact>) =>
                set({ selectedContact: contact }),
            addContact: (contact: Contact) => {
                if (!holdsAnyAddress(contact)) return false
                const existing = get().contacts ?? []
                assertNoFamilyConflict(existing, contact.addresses)
                set({ contacts: [...existing, contact] })
                return true
            },
            editContact: (previous: ContactRef, contact: Contact) => {
                if (!holdsAnyAddress(contact)) return false
                const existing = get().contacts ?? []
                const idx = findContactIndex(existing, previous)
                if (idx < 0) {
                    throw new ContactNotFoundError(previous)
                }
                assertNoFamilyConflict(existing, contact.addresses, idx)
                const updated = [...existing]
                updated[idx] = contact
                set({ contacts: updated })
                return true
            },
            deleteContact: (contact: Contact) => {
                const existing = get().contacts ?? []
                const refs = addressEntries(contact.addresses)
                const remaining = existing.filter(
                    c =>
                        !refs.some(
                            ([family, address]) =>
                                c.addresses[family] === address,
                        ),
                )
                if (remaining.length === existing.length) return false
                set({ contacts: remaining })
                return true
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: createJSONStorage(() => getProvider().keyValueStorage),
            version: STORE_VERSION,
            migrate: migrateContactsState,
            partialize: (state): PersistedContactsState => ({
                contacts: state.contacts,
            }),
        },
    ),
)

registerStore({
    name: STORE_NAME,
    clearStorage: () =>
        (
            useContactsStore as unknown as {
                persist: { clearStorage: () => void }
            }
        ).persist.clearStorage(),
    resetState: () => useContactsStore.getState().resetState(),
})
