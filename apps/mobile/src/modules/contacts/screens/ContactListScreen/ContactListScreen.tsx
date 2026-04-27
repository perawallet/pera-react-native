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
import { KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Contact } from '@perawallet/wallet-core-contacts'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'

import {
    PWButton,
    PWFlatList,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ContactAvatar } from '@components/ContactAvatar'
import { EmptyView } from '@components/EmptyView'
import { SearchInput } from '@components/SearchInput'
import { SHORT_ADDRESS_FORMAT } from '@constants/ui'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { ContactQRBottomSheet } from '@modules/contacts/components/ContactQRBottomSheet'
import { useContactListScreen } from './useContactListScreen'
import { useStyles } from './styles'

type ContactRowProps = {
    contact: Contact
    onShowQR: (contact: Contact) => void
    onSelect: (contact: Contact) => void
}

const ContactRow = ({ contact, onShowQR, onSelect }: ContactRowProps) => {
    const styles = useStyles()

    const handlePress = useCallback(
        () => onSelect(contact),
        [contact, onSelect],
    )
    const handleShowQR = useCallback(
        () => onShowQR(contact),
        [contact, onShowQR],
    )

    return (
        <PWTouchableOpacity
            onPress={handlePress}
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
                onPress={handleShowQR}
            />
        </PWTouchableOpacity>
    )
}

export const ContactListScreen = () => {
    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ listPaddingBottom: Math.max(insets.bottom, 24) })

    const onNavigateAddContact = useCallback(
        () => navigation.navigate('AddContact'),
        [navigation],
    )
    const onNavigateViewContact = useCallback(
        () => navigation.navigate('ViewContact'),
        [navigation],
    )

    const {
        allContactsCount,
        contacts,
        search,
        onSearchChange,
        qrContact,
        isEmpty,
        goToAddContact,
        showQR,
        closeQR,
        selectContact,
    } = useContactListScreen({ onNavigateAddContact, onNavigateViewContact })

    useNavigationHeader({
        enabled: true,
        right: allContactsCount ? (
            <PWIcon
                name='plus'
                onPress={goToAddContact}
            />
        ) : null,
    })

    const renderItem = useCallback(
        ({ item }: { item: Contact }) => (
            <ContactRow
                contact={item}
                onShowQR={showQR}
                onSelect={selectContact}
            />
        ),
        [selectContact, showQR],
    )

    const keyExtractor = useCallback((c: Contact) => c.address, [])

    if (isEmpty) {
        return (
            <>
                <EmptyView
                    icon='contacts'
                    title={t('contacts.list.no_contacts_title')}
                    body={t('contacts.list.no_contacts_body')}
                    button={
                        <PWButton
                            title={t('contacts.list.add_contact')}
                            onPress={goToAddContact}
                            variant='primary'
                            style={styles.emptyButton}
                        />
                    }
                />
                <ContactQRBottomSheet
                    contact={qrContact}
                    onClose={closeQR}
                />
            </>
        )
    }

    return (
        <>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <PWView style={styles.searchWrapper}>
                    <SearchInput
                        placeholder={t('contacts.list.search_placeholder')}
                        value={search}
                        onChangeText={onSearchChange}
                    />
                </PWView>
                <PWFlatList
                    data={contacts}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps='handled'
                    keyboardDismissMode='interactive'
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <EmptyView
                            title={t('contacts.list.no_matching_title')}
                            body={t('contacts.list.no_matching_body')}
                        />
                    }
                />
            </KeyboardAvoidingView>
            <ContactQRBottomSheet
                contact={qrContact}
                onClose={closeQR}
            />
        </>
    )
}
