import {
    useAllAccounts,
    useRemoveAccountById,
} from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useQueryClient } from '@tanstack/react-query'

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
