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

import { useMemo, useState } from 'react'
import { SectionList } from 'react-native'
import { useNavigation, ParamListBase } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Text } from '@rneui/themed'

import EmptyView from '@components/empty-view/EmptyView'
import PWButton from '@components/button/PWButton'
import { useStyles } from './ContactListScreen.styles'
import { Contact, useContacts } from '@perawallet/wallet-core-contacts'
import ContactAvatar from '@components/contact-avatar/ContactAvatar'
import PWView from '@components/view/PWView'
import PWTouchableOpacity from '@components/touchable-opacity/PWTouchableOpacity'
import SearchInput from '@components/search-input/SearchInput'
import { useLanguage } from '@hooks/language'

const contactSorter = (a: Contact, b: Contact) => a.name.localeCompare(b.name)

type ContactSection = {
    title: string
    data: Contact[]
}

const SectionHeader = ({ title }: { title: string }) => {
    const styles = useStyles()
    return (
        <Text
            h3
            h3Style={styles.sectionHeader}
        >
            {title}
        </Text>
    )
}

const ContactItem = ({ contact }: { contact: Contact }) => {
    const { setSelectedContact } = useContacts()
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

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
                size='small'
            />
            <Text style={styles.contactName}>{contact.name}</Text>
        </PWTouchableOpacity>
    )
}

const ContactListScreen = () => {
    const { findContacts, setSelectedContact } = useContacts()
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const [search, setSearch] = useState('')
    const { t } = useLanguage()

    const groupedContacts = useMemo(() => {
        const groups: Record<string, Contact[]> = {}

        findContacts({
            keyword: search,
            matchAddress: true,
            matchName: true,
        }).forEach(c => {
            const initial = c.name.charAt(0).toUpperCase()
            if (!groups[initial]) {
                groups[initial] = [c]
            } else {
                groups[initial].push(c)
            }
        })

        const sectionedContacts: ContactSection[] = []
        Object.entries(groups).forEach(e => {
            sectionedContacts.push({
                title: e[0],
                data: e[1].sort(contactSorter),
            })
        })

        return sectionedContacts.sort((a, b) => a.title.localeCompare(b.title))
    }, [findContacts, search])

    const goToAddContact = () => {
        setSelectedContact(null)
        navigation.navigate('AddContact')
    }

    return (
        <>
            {!groupedContacts.length && !search.length && (
                <EmptyView
                    title={t('contacts.list.no_contacts_title')}
                    body={t('contacts.list.no_contacts_body')}
                    icon='person'
                    button={
                        <PWButton
                            title={t('contacts.list.add_contact')}
                            onPress={goToAddContact}
                            variant='primary'
                        />
                    }
                />
            )}
            {(!!groupedContacts.length || search.length) && (
                <PWView style={styles.flex}>
                    <SearchInput
                        placeholder={t('contacts.list.search_placeholder')}
                        onChangeText={setSearch}
                    />
                    <SectionList
                        sections={groupedContacts}
                        contentContainerStyle={
                            groupedContacts.length
                                ? styles.container
                                : styles.flex
                        }
                        renderSectionHeader={s => (
                            <SectionHeader title={s.section.title} />
                        )}
                        renderItem={item => <ContactItem contact={item.item} />}
                        ListEmptyComponent={
                            <EmptyView
                                title={t('contacts.list.no_matching_title')}
                                body={t('contacts.list.no_matching_body')}
                                icon='person'
                            />
                        }
                    />
                </PWView>
            )}
        </>
    )
}

export default ContactListScreen
