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

import { describe, test, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useContacts } from '../'
import type { Contact } from '../../models'

// Mock the useAppStore hook
const mockUseAppStore = vi.fn()
vi.mock('../../store', () => ({
    useContactsStore: () => mockUseAppStore(),
}))

describe('useContacts', () => {
    test('returns contacts and functions from store', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' },
        ]
        const mockSaveContact = vi.fn()
        const mockDeleteContact = vi.fn()

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: mockSaveContact,
            deleteContact: mockDeleteContact,
        })

        const { result } = renderHook(() => useContacts())

        expect(result.current.contacts).toEqual(mockContacts)
        expect(result.current.findContacts).toBeDefined()
        expect(result.current.saveContact).toBe(mockSaveContact)
        expect(result.current.deleteContact).toBe(mockDeleteContact)
    })

    test('findContacts returns contacts matching address', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'ALICE123' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns contacts matching name', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns contacts matching NFD', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123', nfd: 'alice.algo' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice.algo' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns empty array when no match', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'charlie' })
        expect(found).toEqual([])
    })

    test('findContacts can disable address matching', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
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
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
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
            { name: 'Alice', address: 'ALICE123', nfd: 'alice.algo' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
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
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'ALICE' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts searches partial matches', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'LIC' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns all matches when multiple contacts match', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Alice Cooper', address: 'COOPER456' },
            { name: 'Bob', address: 'BOB456' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice' })
        expect(found).toEqual([mockContacts[0], mockContacts[1]])
    })

    test('findContacts returns multiple matches across different fields', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456', nfd: 'alice.domain' },
            { name: 'Charlie', address: 'CHARLIE789' },
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn(),
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice' })
        expect(found).toEqual([mockContacts[0], mockContacts[1]])
    })

    test('returns selectedContact from store', () => {
        const mockContact: Contact = { name: 'Alice', address: 'ALICE123' }
        const mockSetSelectedContact = vi.fn()

        mockUseAppStore.mockReturnValue({
            contacts: [],
            saveContact: vi.fn(),
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
            saveContact: vi.fn(),
            deleteContact: vi.fn(),
            selectedContact: null,
            setSelectedContact: mockSetSelectedContact,
        })

        const { result } = renderHook(() => useContacts())

        expect(result.current.selectedContact).toBeNull()
    })
})
