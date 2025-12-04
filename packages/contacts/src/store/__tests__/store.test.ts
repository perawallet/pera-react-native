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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContactsStore, initContactsStore } from '../index'
import { Contact } from '../../models'

// Mock the storage service
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useKeyValueStorageService: vi.fn(() => ({
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    })),
}))

describe('ContactsStore', () => {
    beforeEach(() => {
        initContactsStore()
    })

    test('should add a contact', () => {
        const { result } = renderHook(() => useContactsStore())
        const contact: Contact = {
            id: 'test-id',
            name: 'Alice',
            address: 'ALICE123',
        }

        act(() => {
            result.current.saveContact(contact)
        })

        expect(result.current.contacts).toHaveLength(1)
        expect(result.current.contacts[0]).toEqual(contact)
    })

    test('should not add duplicate contact', () => {
        const { result } = renderHook(() => useContactsStore())
        const contact: Contact = {
            id: 'test-id',
            name: 'Alice',
            address: 'ALICE123',
        }

        act(() => {
            result.current.saveContact(contact)
        })

        act(() => {
            const added = result.current.saveContact(contact)
            expect(added).toBe(false)
        })

        expect(result.current.contacts).toHaveLength(1)
    })

    test('should remove a contact', () => {
        const { result } = renderHook(() => useContactsStore())
        const contact: Contact = {
            id: 'test-id',
            name: 'Alice',
            address: 'ALICE123',
        }

        act(() => {
            result.current.saveContact(contact)
        })

        expect(result.current.contacts).toHaveLength(1)

        act(() => {
            result.current.deleteContact(contact)
        })

        expect(result.current.contacts).toHaveLength(0)
    })
})
