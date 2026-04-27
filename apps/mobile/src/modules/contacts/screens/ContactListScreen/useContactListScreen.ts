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

import { useCallback, useMemo, useState } from 'react'
import { Keyboard } from 'react-native'
import { Contact, useContacts } from '@perawallet/wallet-core-contacts'

export type UseContactListScreenResult = {
    allContactsCount: number
    contacts: Contact[]
    search: string
    onSearchChange: (value: string) => void
    qrContact: Contact | null
    isEmpty: boolean
    goToAddContact: () => void
    showQR: (contact: Contact) => void
    closeQR: () => void
    selectContact: (contact: Contact) => void
}

type UseContactListScreenOptions = {
    onNavigateAddContact: () => void
    onNavigateViewContact: () => void
}

export const useContactListScreen = ({
    onNavigateAddContact,
    onNavigateViewContact,
}: UseContactListScreenOptions): UseContactListScreenResult => {
    const {
        contacts: allContacts,
        findContacts,
        setSelectedContact,
    } = useContacts()
    const [search, setSearch] = useState('')
    const [qrContact, setQrContact] = useState<Contact | null>(null)

    const contacts = useMemo(
        () =>
            findContacts({
                keyword: search,
                matchAddress: true,
                matchName: true,
            }).sort((a, b) => a.name.localeCompare(b.name)),
        [findContacts, search],
    )

    const isEmpty = !contacts.length && !search.length

    const goToAddContact = useCallback(() => {
        setSelectedContact(null)
        onNavigateAddContact()
    }, [onNavigateAddContact, setSelectedContact])

    const showQR = useCallback((contact: Contact) => {
        Keyboard.dismiss()
        setQrContact(contact)
    }, [])

    const closeQR = useCallback(() => setQrContact(null), [])

    const selectContact = useCallback(
        (contact: Contact) => {
            setSelectedContact(contact)
            onNavigateViewContact()
        },
        [onNavigateViewContact, setSelectedContact],
    )

    return {
        allContactsCount: allContacts.length,
        contacts,
        search,
        onSearchChange: setSearch,
        qrContact,
        isEmpty,
        goToAddContact,
        showQR,
        closeQR,
        selectContact,
    }
}
