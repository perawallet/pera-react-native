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

import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useKeyValueStorageService } from '@perawallet/wallet-core-platform-integration'
import type { Contact, ContactsState } from '../models'
import type { WithPersist } from '@perawallet/wallet-core-shared'
import { v7 as uuidv7 } from 'uuid'

export const useContactsStore: UseBoundStore<
    WithPersist<StoreApi<ContactsState>, unknown>
> = create<ContactsState>()(
    persist(
        (set, get) => ({
            contacts: [],

            selectedContact: null,
            setSelectedContact: (contact: Contact | null) =>
                set({ selectedContact: contact }),
            setContacts: (contacts: Contact[]) => set({ contacts }),
            saveContact: (contact: Contact) => {
                const existing = get().contacts ?? []
                const newContact = {
                    ...contact,
                    id: contact.id ?? uuidv7(),
                }
                if (!existing.find(r => r.id === newContact.id)) {
                    set({ contacts: [...existing, newContact] })
                    return true
                }
                return false
            },
            deleteContact: (contact: Contact) => {
                const existing = get().contacts ?? []
                const remaining = existing.filter(r => r.id !== contact.id)

                if (remaining.length != existing.length) {
                    set({ contacts: remaining })
                }

                return remaining.length != existing.length
            },
        }),
        {
            name: 'contacts-store',
            storage: createJSONStorage(useKeyValueStorageService),
            version: 1,
            partialize: state => ({
                contacts: state.contacts,
            }),
        },
    ),
)
