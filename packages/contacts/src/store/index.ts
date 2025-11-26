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
            setSelectedContact: (contact: Contact | null) => set({ selectedContact: contact }),
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
