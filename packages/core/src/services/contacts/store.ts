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
            set({contacts: [...without, contact]})
        },
        deleteContact: (contact: Contact) => {
            const contacts = get().contacts
            const without = contacts.filter(c => c.address !== contact.address)
            set({contacts: without})
            return contacts.length !== without.length
        },
    }
}

export const partializeContactsSlice = (state: ContactsSlice) => {
    return {
        contacts: state.contacts,
    }
}
