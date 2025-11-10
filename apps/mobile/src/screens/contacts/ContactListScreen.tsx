import { useStyles } from './ContactListScreen.styles'
import MainScreenLayout from '../../layouts/MainScreenLayout'
import { Contact, useContacts } from '@perawallet/core'
import { useCallback } from 'react';
import EmptyView from '../../components/common/empty-view/EmptyView';
import PersonIcon from '../../../assets/icons/person-menu.svg'
import PeraButton from '../../components/common/button/PeraButton';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

const contactSorter = (a: Contact, b: Contact) => a.name.localeCompare(b.name)

const ContactListScreen = () => {
  const styles = useStyles()
  const { contacts } = useContacts()
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();

  const groupedContacts = useCallback(() => {
    const groups: Record<string, Contact[]> = {}

    contacts.forEach(c => {
      const initial = c.name.charAt(0).toUpperCase()
      if (!groups[initial]) {
        groups[initial] = [c]
      } else {
        groups[initial].push(c)
      }
    })

    Object.entries(groups).forEach(e => {
      groups[e[0]] = e[1].sort(contactSorter)
    })

    return groups
  }, [contacts])

  const goToAddContact = () => { 
    navigation.navigate('AddContact')
  }

  return (
    <MainScreenLayout>
      {!contacts.length 
        && <EmptyView title="No Contacts" body="You haven't added any contacts yet" 
              icon={<PersonIcon />} 
              button={<PeraButton title="Add Contact" onPress={goToAddContact} variant="primary" />} />}
    </MainScreenLayout>
  );
};

export default ContactListScreen;
