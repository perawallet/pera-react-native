import { ParamListBase, useNavigation } from '@react-navigation/native';
import PlusIcon from '../../../assets/icons/plus.svg';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useContacts } from '@perawallet/core';

const ContactListHeaderButtons = () => {
  const { setSelectedContact } = useContacts();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const goToAdd = () => {
    setSelectedContact(null);
    navigation.navigate('AddContact');
  };

  return <PlusIcon onPress={goToAdd} />;
};

export default ContactListHeaderButtons;
