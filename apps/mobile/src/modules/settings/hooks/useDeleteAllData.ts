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

import {
    useAllAccounts,
    useRemoveAccountById,
} from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useQueryClient } from '@tanstack/react-query'

/**
 * A hook that returns a function to wipe all application data.
 * This includes all accounts, contacts, preferences, and cached queries.
 *
 * @returns A function that performs the data wipe when called.
 *
 * @example
 * const deleteData = useDeleteAllData()
 * const handleWipe = () => deleteData()
 */
export const useDeleteAllData = () => {
    const accounts = useAllAccounts()
    const removeAccountById = useRemoveAccountById()
    const { contacts, deleteContact } = useContacts()
    const { clearAllPreferences } = usePreferences()
    const queryClient = useQueryClient()

    return () => {
        accounts.forEach(account => {
            if (account.id) {
                removeAccountById(account.id)
            }
        })

        contacts.forEach(contact => {
            deleteContact(contact)
        })

        queryClient.removeQueries()

        clearAllPreferences()
    }
}
