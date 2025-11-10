import { describe, test, expect } from 'vitest'
import {
    createContactsSlice,
    partializeContactsSlice,
    type ContactsSlice,
} from '../store'
import type { Contact } from '../types'

describe('services/contacts/store', () => {
    test('defaults to empty contacts array', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        expect(state.contacts).toEqual([])
    })

    test('setContacts updates contacts array', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        const contacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' },
        ]

        state.setContacts(contacts)
        expect(state.contacts).toEqual(contacts)
    })

    test('saveContact adds new contact', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        const contact: Contact = { name: 'Alice', address: 'ALICE123' }
        state.saveContact(contact)

        expect(state.contacts).toHaveLength(1)
        expect(state.contacts[0]).toEqual(contact)
    })

    test('saveContact updates existing contact by address', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        const originalContact: Contact = { name: 'Alice', address: 'ALICE123' }
        const updatedContact: Contact = {
            name: 'Alice Smith',
            address: 'ALICE123',
            nfd: 'alice.algo',
        }

        state.saveContact(originalContact)
        state.saveContact(updatedContact)

        expect(state.contacts).toHaveLength(1)
        expect(state.contacts[0]).toEqual(updatedContact)
    })

    test('saveContact preserves other contacts when updating', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        const contact1: Contact = { name: 'Alice', address: 'ALICE123' }
        const contact2: Contact = { name: 'Bob', address: 'BOB456' }
        const updatedContact1: Contact = {
            name: 'Alice Smith',
            address: 'ALICE123',
        }

        state.saveContact(contact1)
        state.saveContact(contact2)
        state.saveContact(updatedContact1)

        expect(state.contacts).toHaveLength(2)
        expect(state.contacts).toContainEqual(updatedContact1)
        expect(state.contacts).toContainEqual(contact2)
    })

    test('deleteContact removes existing contact and returns true', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        const contact: Contact = { name: 'Alice', address: 'ALICE123' }
        state.saveContact(contact)

        const result = state.deleteContact(contact)

        expect(result).toBe(true)
        expect(state.contacts).toHaveLength(0)
    })

    test('deleteContact returns false when contact not found', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        const contact: Contact = { name: 'Alice', address: 'ALICE123' }
        const result = state.deleteContact(contact)

        expect(result).toBe(false)
        expect(state.contacts).toHaveLength(0)
    })

    test('deleteContact only removes contact with matching address', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        const contact1: Contact = { name: 'Alice', address: 'ALICE123' }
        const contact2: Contact = { name: 'Bob', address: 'BOB456' }
        const contactToDelete: Contact = {
            name: 'Charlie',
            address: 'ALICE123',
        } // Same address as contact1

        state.saveContact(contact1)
        state.saveContact(contact2)
        state.deleteContact(contactToDelete)

        expect(state.contacts).toHaveLength(1)
        expect(state.contacts[0]).toEqual(contact2)
    })

    test('partializeContactsSlice returns only persisted subset', () => {
        const state: ContactsSlice = {
            contacts: [
                { name: 'Alice', address: 'ALICE123' },
                { name: 'Bob', address: 'BOB456' },
            ],
            selectedContact: null,
            setSelectedContact: () => {},
            setContacts: () => {},
            saveContact: () => {},
            deleteContact: () => false,
        }

        const partial = partializeContactsSlice(state)
        expect(partial).toEqual({
            contacts: [
                { name: 'Alice', address: 'ALICE123' },
                { name: 'Bob', address: 'BOB456' },
            ],
        })

        // ensure functions are not included
        expect((partial as any).setContacts).toBeUndefined()
        expect((partial as any).saveContact).toBeUndefined()
        expect((partial as any).deleteContact).toBeUndefined()
    })

    test('setSelectedContact updates selected contact', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        const contact: Contact = { name: 'Alice', address: 'ALICE123' }
        state.setSelectedContact(contact)

        expect(state.selectedContact).toEqual(contact)
    })

    test('setSelectedContact can set to null', () => {
        let state: ContactsSlice

        const set = (partial: Partial<ContactsSlice>) => {
            state = {
                ...(state as ContactsSlice),
                ...(partial as ContactsSlice),
            }
        }
        const get = () => state

        state = createContactsSlice(set as any, get as any, {} as any)

        const contact: Contact = { name: 'Alice', address: 'ALICE123' }
        state.setSelectedContact(contact)
        expect(state.selectedContact).toEqual(contact)

        state.setSelectedContact(null)
        expect(state.selectedContact).toBeNull()
    })
})
