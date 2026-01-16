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

import { useCallback } from 'react'
import { useContactsStore } from '../store'

/**
 * A hook for managing and searching contacts in the user's address book.
 * Provides methods for CRUD operations and advanced searching.
 *
 * @returns An object containing contacts state and management methods.
 */
export const useContacts = () => {
    const {
        contacts,
        saveContact,
        deleteContact,
        selectedContact,
        setSelectedContact,
    } = useContactsStore()

    /**
     * Searches for contacts matching a keyword across multiple fields.
     *
     * @param params - Search parameters
     * @param params.keyword - The search term (address, name, or NFD)
     * @param params.matchAddress - Whether to search in the address field
     * @param params.matchName - Whether to search in the name field
     * @param params.matchNFD - Whether to search in the NFD field
     * @returns A filtered array of contacts that match the criteria.
     */
    const findContacts = useCallback(
        ({
            keyword,
            matchAddress = true,
            matchName = true,
            matchNFD = true,
        }: {
            keyword: string
            matchAddress?: boolean
            matchName?: boolean
            matchNFD?: boolean
        }) => {
            const lowerPartial = keyword.toLowerCase()
            const matches = contacts.filter(c => {
                return (
                    (matchAddress &&
                        c.address.toLowerCase().includes(lowerPartial)) ||
                    (matchName &&
                        c.name.toLowerCase().includes(lowerPartial)) ||
                    (matchNFD && c.nfd?.toLowerCase().includes(lowerPartial))
                )
            })
            return matches
        },
        [contacts],
    )

    return {
        selectedContact,
        contacts,
        setSelectedContact,
        findContacts,
        saveContact,
        deleteContact,
    }
}
