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
import {
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Contact, useContacts } from '@perawallet/wallet-core-contacts'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

import {
    PWButton,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { SearchInput } from '@components/SearchInput'
import { SHORT_ADDRESS_FORMAT } from '@constants/ui'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { ContactQRBottomSheet } from '@modules/contacts/components/ContactQRBottomSheet'
import { useStyles } from './styles'

const ContactRow = ({
    contact,
    onShowQR,
}: {
    contact: Contact
    onShowQR: (contact: Contact) => void
}) => {
    const { setSelectedContact } = useContacts()
    const styles = useStyles()
    const navigation = useAppNavigation()

    const viewContact = () => {
        setSelectedContact(contact)
        navigation.navigate('ViewContact')
    }

    return (
        <PWTouchableOpacity
            onPress={viewContact}
            style={styles.contactContainer}
        >
            <ContactAvatar
                contact={contact}
                size='md'
            />
            <PWView style={styles.contactTextContainer}>
                <PWText
                    style={styles.contactName}
                    numberOfLines={1}
                    ellipsizeMode='tail'
                >
                    {contact.name}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.contactAddress}
                >
                    {truncateAlgorandAddress(
                        contact.address,
                        SHORT_ADDRESS_FORMAT,
                    )}
                </PWText>
            </PWView>
            <PWIcon
                name='qr'
                variant='primary'
                onPress={() => onShowQR(contact)}
            />
        </PWTouchableOpacity>
    )
}

export const ContactListScreen = () => {
    const {
        contacts: allContacts,
        findContacts,
        setSelectedContact,
    } = useContacts()
    const navigation = useAppNavigation()
    const [search, setSearch] = useState('')
    const [qrContact, setQrContact] = useState<Contact | null>(null)
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ listPaddingBottom: Math.max(insets.bottom, 24) })

    const contacts = useMemo(
        () =>
            findContacts({
                keyword: search,
                matchAddress: true,
                matchName: true,
            }).sort((a, b) => a.name.localeCompare(b.name)),
        [findContacts, search],
    )

    const goToAddContact = useCallback(() => {
        setSelectedContact(null)
        navigation.navigate('AddContact')
    }, [navigation, setSelectedContact])

    useNavigationHeader({
        enabled: true,
        right: allContacts.length ? (
            <PWIcon
                name='plus'
                onPress={goToAddContact}
            />
        ) : null,
    })

    const handleShowQR = useCallback((contact: Contact) => {
        Keyboard.dismiss()
        setQrContact(contact)
    }, [])

    const isEmpty = !contacts.length && !search.length

    return (
        <>
            {isEmpty && (
                <PWView style={styles.emptyState}>
                    <PWView style={styles.emptyIconContainer}>
                        <PWIcon
                            name='contacts'
                            variant='primary'
                            size='xl'
                        />
                    </PWView>
                    <PWText
                        variant='h3'
                        style={styles.emptyTitle}
                    >
                        {t('contacts.list.no_contacts_title')}
                    </PWText>
                    <PWText style={styles.emptyBody}>
                        {t('contacts.list.no_contacts_body')}
                    </PWText>
                    <PWButton
                        title={t('contacts.list.add_contact')}
                        onPress={goToAddContact}
                        variant='primary'
                        style={styles.emptyButton}
                    />
                </PWView>
            )}
            {!isEmpty && (
                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <PWView style={styles.searchWrapper}>
                        <SearchInput
                            placeholder={t('contacts.list.search_placeholder')}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </PWView>
                    <FlatList
                        data={contacts}
                        keyExtractor={c => c.id ?? c.address}
                        contentContainerStyle={styles.listContent}
                        keyboardShouldPersistTaps='handled'
                        keyboardDismissMode='interactive'
                        renderItem={({ item }) => (
                            <ContactRow
                                contact={item}
                                onShowQR={handleShowQR}
                            />
                        )}
                        ListEmptyComponent={
                            <PWView style={styles.noMatch}>
                                <PWText variant='h3'>
                                    {t('contacts.list.no_matching_title')}
                                </PWText>
                                <PWText style={styles.noMatchBody}>
                                    {t('contacts.list.no_matching_body')}
                                </PWText>
                            </PWView>
                        }
                    />
                </KeyboardAvoidingView>
            )}
            <ContactQRBottomSheet
                contact={qrContact}
                onClose={() => setQrContact(null)}
            />
        </>
    )
}
