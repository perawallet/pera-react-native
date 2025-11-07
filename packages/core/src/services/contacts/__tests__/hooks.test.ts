import { describe, test, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useContacts } from '../hooks'
import type { Contact } from '../types'

// Mock the useAppStore hook
const mockUseAppStore = vi.fn()
vi.mock('../../../store', () => ({
    useAppStore: () => mockUseAppStore()
}))

describe('services/contacts/hooks', () => {
    test('returns contacts and functions from store', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' }
        ]
        const mockSaveContact = vi.fn()
        const mockDeleteContact = vi.fn()

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: mockSaveContact,
            deleteContact: mockDeleteContact
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
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'ALICE123' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns contacts matching name', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns contacts matching NFD', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123', nfd: 'alice.algo' },
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice.algo' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns empty array when no match', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'charlie' })
        expect(found).toEqual([])
    })

    test('findContacts can disable address matching', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({
            keyword: 'ALICE123',
            matchAddress: false
        })
        expect(found).toEqual([])
    })

    test('findContacts can disable name matching', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({
            keyword: 'alice',
            matchName: false,
            matchAddress: false
        })
        expect(found).toEqual([])
    })

    test('findContacts can disable NFD matching', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123', nfd: 'alice.algo' },
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({
            keyword: 'alice.algo',
            matchNFD: false
        })
        expect(found).toEqual([])
    })

    test('findContacts performs case-insensitive search', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'ALICE' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts searches partial matches', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'LIC' })
        expect(found).toEqual([mockContacts[0]])
    })

    test('findContacts returns all matches when multiple contacts match', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Alice Cooper', address: 'COOPER456' },
            { name: 'Bob', address: 'BOB456' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice' })
        expect(found).toEqual([mockContacts[0], mockContacts[1]])
    })

    test('findContacts returns multiple matches across different fields', () => {
        const mockContacts: Contact[] = [
            { name: 'Alice', address: 'ALICE123' },
            { name: 'Bob', address: 'BOB456', nfd: 'alice.domain' },
            { name: 'Charlie', address: 'CHARLIE789' }
        ]

        mockUseAppStore.mockReturnValue({
            contacts: mockContacts,
            saveContact: vi.fn(),
            deleteContact: vi.fn()
        })

        const { result } = renderHook(() => useContacts())

        const found = result.current.findContacts({ keyword: 'alice' })
        expect(found).toEqual([mockContacts[0], mockContacts[1]])
    })
})