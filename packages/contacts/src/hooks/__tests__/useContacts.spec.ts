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

// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useContacts } from '../'
import type { ChainFamily } from '@perawallet/wallet-core-chain-contract'
import type { Contact, ContactAddresses } from '../../models'

// Mock the useAppStore hook
const mockUseAppStore = vi.fn()
vi.mock('../../store', () => ({
    useContactsStore: () => mockUseAppStore(),
}))

// The union has one member today; a second family exercises the filter.
const OTHER_FAMILY = 'other' as ChainFamily

describe('useContacts', () => {
    test('returns contacts and functions from store', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-31',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-32',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]
        const mockAddContact = vi.fn()
        const mockEditContact = vi.fn()
        const mockDeleteContact = vi.fn()

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: mockAddContact,
            editContact: mockEditContact,
            deleteContact: mockDeleteContact,
        })

        const { result } = renderHook(() => useContacts())

        expect(result.current.contacts).toEqual(mockContacts)
        expect(result.current.findContacts).toBeDefined()
        expect(result.current.addContact).toBe(mockAddContact)
        expect(result.current.editContact).toBe(mockEditContact)
        expect(result.current.deleteContact).toBe(mockDeleteContact)
    })

    test('findContacts returns contacts matching address', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-56',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-57',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'ALICE123' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns contacts matching name', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-75',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-76',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns contacts matching NFD', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-94',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
                nfd: 'alice.algo',
            },
            {
                id: 'contact-99',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice.algo' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns empty array when no match', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-117',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-118',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'charlie' })
        expect(found).toEqual([])
    })

    test('findContacts can disable address matching', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-136',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-137',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({
            keyword: 'ALICE123',
            matchAddress: false,
        })
        expect(found).toEqual([])
    })

    test('findContacts can disable name matching', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-158',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-159',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({
            keyword: 'alice',
            matchName: false,
            matchAddress: false,
        })
        expect(found).toEqual([])
    })

    test('findContacts can disable NFD matching', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-181',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
                nfd: 'alice.algo',
            },
            {
                id: 'contact-186',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({
            keyword: 'alice.algo',
            matchNFD: false,
        })
        expect(found).toEqual([])
    })

    test('findContacts performs case-insensitive search', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-207',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-208',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'ALICE' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts searches partial matches', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-226',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-227',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'LIC' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns all matches when multiple contacts match', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-245',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-246',
                name: 'Alice Cooper',
                addresses: { algorand: 'COOPER456' },
            },
            {
                id: 'contact-247',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice' })
        expect(found).toEqual([mockContacts[0], mockContacts[1]])
    })

    test('findContacts returns multiple matches across different fields', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-265',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-266',
                name: 'Bob',
                addresses: { algorand: 'BOB456' },
                nfd: 'alice.domain',
            },
            {
                id: 'contact-271',
                name: 'Charlie',
                addresses: { algorand: 'CHARLIE789' },
            },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice' })
        expect(found).toEqual([mockContacts[0], mockContacts[1]])
    })

    test('findContacts with a family returns only contacts holding an address in it', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-289',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-290',
                name: 'Alicia',
                addresses: { [OTHER_FAMILY]: 'ALICIA456' },
            },
        ]

        mockUseAppStore.mockReturnValue({ contacts: mockContacts })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({
            keyword: 'ali',
            family: 'algorand',
        })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts with a family matches the address only within that family', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-306',
                name: 'Alice',
                addresses: {
                    algorand: 'ALICE123',
                    other: 'SHARED',
                } as ContactAddresses,
            },
        ]

        mockUseAppStore.mockReturnValue({ contacts: mockContacts })

        const { result } = renderHook(() => useContacts())

        expect(
            result.current.findContacts({
                keyword: 'SHARED',
                family: 'algorand',
            }),
        ).toEqual([])
    })

    test('findContacts without a family matches an address in any family', () => {
        const mockContacts: Contact[] = [
            {
                id: 'contact-329',
                name: 'Alice',
                addresses: { algorand: 'ALICE123' },
            },
            {
                id: 'contact-330',
                name: 'Bob',
                addresses: { [OTHER_FAMILY]: 'BOB456' },
            },
        ]

        mockUseAppStore.mockReturnValue({ contacts: mockContacts })

        const { result } = renderHook(() => useContacts())

        expect(result.current.findContacts({ keyword: 'BOB456' })).toEqual([
            mockContacts[1],
        ])
    })

    test('returns selectedContact from store', () => {
        const mockContact: Contact = {
            id: 'id-1',
            name: 'Alice',
            addresses: { algorand: 'ALICE123' },
        }
        const mockSetSelectedContact = vi.fn()

        mockUseAppStore.mockReturnValue({
            contacts: [],
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
            selectedContact: mockContact,
            setSelectedContact: mockSetSelectedContact,
        })

        const { result } = renderHook(() => useContacts())

        expect(result.current.selectedContact).toEqual(mockContact)
        expect(result.current.setSelectedContact).toBe(mockSetSelectedContact)
    })

    test('returns null selectedContact when not set', () => {
        const mockSetSelectedContact = vi.fn()

        mockUseAppStore.mockReturnValue({
            contacts: [],
            addContact: vi.fn(),
            editContact: vi.fn(),
            deleteContact: vi.fn(),
            selectedContact: null,
            setSelectedContact: mockSetSelectedContact,
        })

        const { result } = renderHook(() => useContacts())

        expect(result.current.selectedContact).toBeNull()
    })
})
