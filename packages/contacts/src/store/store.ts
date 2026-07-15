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
import type { Contact, ContactsState } from '../models'
import { ContactNotFoundError, DuplicateAddressError } from '../errors'
import {
    registerStore,
    type WithPersist,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'

const STORE_NAME = 'contacts-store'

const initialState = {
    contacts: [] as Contact[],
    selectedContact: null as Nullable<Contact>,
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
                const existing = get().contacts ?? []
                if (existing.some(c => c.address === contact.address)) {
                    throw new DuplicateAddressError(contact.address)
                }
                set({ contacts: [...existing, contact] })
                return true
            },
            editContact: (previousAddress: string, contact: Contact) => {
                const existing = get().contacts ?? []
                if (
                    contact.address !== previousAddress &&
                    existing.some(c => c.address === contact.address)
                ) {
                    throw new DuplicateAddressError(contact.address)
                }
                const idx = existing.findIndex(
                    c => c.address === previousAddress,
                )
                if (idx < 0) {
                    throw new ContactNotFoundError(previousAddress)
                }
                const updated = [...existing]
                updated[idx] = contact
                set({ contacts: updated })
                return true
            },
            deleteContact: (contact: Contact) => {
                const existing = get().contacts ?? []
                const remaining = existing.filter(
                    c => c.address !== contact.address,
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
            version: 1,
            partialize: state => ({
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
