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

import type { StateCreator } from 'zustand'
import { type Contact } from './types'

export type ContactsSlice = {
    contacts: Contact[]
    selectedContact: Contact | null
    setSelectedContact: (contact: Contact | null) => void
    setContacts: (contacts: Contact[]) => void
    saveContact: (contact: Contact) => void
    deleteContact: (contact: Contact) => boolean
}

export const createContactsSlice: StateCreator<
    ContactsSlice,
    [],
    [],
    ContactsSlice
> = (set, get) => {
    return {
        contacts: [],
        selectedContact: null,
        setSelectedContact: (contact: Contact | null) => {
            set({ selectedContact: contact })
        },
        setContacts: (contacts: Contact[]) => {
            set({ contacts })
        },
        saveContact: (contact: Contact) => {
            const contacts = get().contacts
            const without = contacts.filter(c => c.address !== contact.address)
            set({ contacts: [...without, contact] })
        },
        deleteContact: (contact: Contact) => {
            const contacts = get().contacts
            const without = contacts.filter(c => c.address !== contact.address)
            set({ contacts: without })
            return contacts.length !== without.length
        },
    }
}

export const partializeContactsSlice = (state: ContactsSlice) => {
    return {
        contacts: state.contacts,
    }
}
