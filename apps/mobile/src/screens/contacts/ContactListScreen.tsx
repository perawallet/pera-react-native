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

import { useStyles } from './ContactListScreen.styles';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import { Contact, useContacts } from '@perawallet/core';
import { useMemo, useState } from 'react';
import EmptyView from '../../components/common/empty-view/EmptyView';
import PersonIcon from '../../../assets/icons/person-menu.svg';
import PWButton from '../../components/common/button/PWButton';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SectionList } from 'react-native';
import { Text } from '@rneui/themed';
import ContactAvatar from '../../components/common/contact-avatar/ContactAvatar';
import PWView from '../../components/common/view/PWView';
import PWTouchableOpacity from '../../components/common/touchable-opacity/PWTouchableOpacity';
import SearchInput from '../../components/common/search-input/SearchInput';

const contactSorter = (a: Contact, b: Contact) => a.name.localeCompare(b.name);

type ContactSection = {
  title: string;
  data: Contact[];
};

const SectionHeader = ({ title }: { title: string }) => {
  const styles = useStyles();
  return (
    <Text h3 h3Style={styles.sectionHeader}>
      {title}
    </Text>
  );
};

const ContactItem = ({ contact }: { contact: Contact }) => {
  const { setSelectedContact } = useContacts();
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const viewContact = () => {
    setSelectedContact(contact);
    navigation.navigate('ViewContact');
  };
  return (
    <PWTouchableOpacity onPress={viewContact} style={styles.contactContainer}>
      <ContactAvatar contact={contact} size="small" />
      <Text style={styles.contactName}>{contact.name}</Text>
    </PWTouchableOpacity>
  );
};

const ContactListScreen = () => {
  const { findContacts, setSelectedContact } = useContacts();
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const [search, setSearch] = useState('');

  const groupedContacts = useMemo(() => {
    const groups: Record<string, Contact[]> = {};

    findContacts({
      keyword: search,
      matchAddress: true,
      matchName: true
    }).forEach(c => {
      const initial = c.name.charAt(0).toUpperCase();
      if (!groups[initial]) {
        groups[initial] = [c];
      } else {
        groups[initial].push(c);
      }
    });

    const sectionedContacts: ContactSection[] = [];
    Object.entries(groups).forEach(e => {
      sectionedContacts.push({
        title: e[0],
        data: e[1].sort(contactSorter)
      });
    });

    return sectionedContacts.sort((a, b) => a.title.localeCompare(b.title));
  }, [findContacts, search]);

  const goToAddContact = () => {
    setSelectedContact(null);
    navigation.navigate('AddContact');
  };

  return (
    <MainScreenLayout>
      {!groupedContacts.length && !search.length && (
        <EmptyView
          title="No Contacts"
          body="You haven't added any contacts yet"
          icon={<PersonIcon />}
          button={
            <PWButton
              title="Add Contact"
              onPress={goToAddContact}
              variant="primary"
            />
          }
        />
      )}
      {(!!groupedContacts.length || search.length) && (
        <PWView style={styles.flex}>
          <SearchInput
            placeholder="Search for name or address"
            onChangeText={setSearch}
          />
          <SectionList
            sections={groupedContacts}
            contentContainerStyle={
              groupedContacts.length ? styles.container : styles.flex
            }
            renderSectionHeader={s => <SectionHeader title={s.section.title} />}
            renderItem={item => <ContactItem contact={item.item} />}
            ListEmptyComponent={
              <EmptyView
                title="No Matching Contacts"
                body="There aren't any matching contacts."
                icon={<PersonIcon />}
              />
            }
          />
        </PWView>
      )}
    </MainScreenLayout>
  );
};

export default ContactListScreen;
