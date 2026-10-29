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
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import type {
    Contact,
    ContactAddresses,
    ContactsState,
    NewContact,
} from '../models'
import { ContactNotFoundError } from '../errors'
import { derivedContactId } from '../contactId'
import {
    generateUniqueId,
    guardedPersist,
    registerStore,
    type WithPersist,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'contacts-store'
const STORE_VERSION = 3

type PersistedContactsState = {
    contacts: Contact[]
}

const initialState = {
    contacts: [] as Contact[],
    selectedContact: null as Nullable<Contact>,
}

// Nothing could ever find an address-less row again to edit or delete it.
const holdsAnyAddress = ({ addresses }: NewContact): boolean =>
    Object.values(addresses).some(address => !!address)

const heldFamilies = (addresses: ContactAddresses): Set<ChainFamily> =>
    new Set(
        (Object.keys(addresses) as ChainFamily[]).filter(
            family => !!addresses[family],
        ),
    )

const removedFamiliesAfterEdit = (
    previous: Contact,
    next: NewContact,
): Optional<ChainFamily[]> => {
    const held = heldFamilies(next.addresses)
    const removed = new Set([
        ...(previous.removedFamilies ?? []),
        ...heldFamilies(previous.addresses),
    ])
    const remaining = [...removed].filter(family => !held.has(family))
    return remaining.length > 0 ? remaining : undefined
}

type V1Contact = Omit<Contact, 'id' | 'addresses'> & { address?: unknown }
type V2Contact = Omit<Contact, 'id'>

/**
 * v1 stored a single Algorand `address` per contact, and v2 had no `id`. A
 * row without an address could never be selected, edited or backed up, so it
 * is dropped.
 */
export const migrateContactsState = (
    persistedState: unknown,
    version: number,
): PersistedContactsState => {
    if (version >= STORE_VERSION) {
        return persistedState as PersistedContactsState
    }
    const v2Contacts: V2Contact[] =
        version < 2
            ? (
                  (persistedState as { contacts?: V1Contact[] }).contacts ?? []
              ).flatMap(({ address, ...rest }) =>
                  typeof address === 'string' && address.length > 0
                      ? [{ ...rest, addresses: { algorand: address } }]
                      : [],
              )
            : ((persistedState as { contacts?: V2Contact[] }).contacts ?? [])
    return {
        contacts: v2Contacts.flatMap(contact => {
            const id = derivedContactId(contact.addresses)
            return id ? [{ ...contact, id }] : []
        }),
    }
}

export const useContactsStore: UseBoundStore<
    WithPersist<StoreApi<ContactsState>, unknown>
> = create<ContactsState>()(
    guardedPersist(
        (set, get) => ({
            ...initialState,
            setSelectedContact: (contact: Nullable<Contact>) =>
                set({ selectedContact: contact }),
            addContact: (contact: NewContact) => {
                if (!holdsAnyAddress(contact)) return false
                set({
                    contacts: [
                        ...(get().contacts ?? []),
                        { ...contact, id: contact.id ?? generateUniqueId() },
                    ],
                })
                return true
            },
            editContact: (id: string, contact: NewContact) => {
                if (!holdsAnyAddress(contact)) return false
                const existing = get().contacts ?? []
                const idx = existing.findIndex(c => c.id === id)
                if (idx < 0) {
                    throw new ContactNotFoundError(id)
                }
                const updated = [...existing]
                const { removedFamilies: _, ...rest } = contact
                const removedFamilies = removedFamiliesAfterEdit(
                    existing[idx]!,
                    contact,
                )
                updated[idx] = removedFamilies
                    ? { ...rest, id, removedFamilies }
                    : { ...rest, id }
                set({ contacts: updated })
                return true
            },
            deleteContact: (id: string) => {
                const existing = get().contacts ?? []
                const remaining = existing.filter(c => c.id !== id)
                if (remaining.length === existing.length) return false
                set({ contacts: remaining })
                return true
            },
            resetState: () => set(initialState),
        }),
        {
            name: STORE_NAME,
            storage: () => getProvider().keyValueStorage,
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
