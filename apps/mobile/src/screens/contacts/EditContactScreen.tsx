import { Contact } from "@perawallet/core";
import { StaticScreenProps } from "@react-navigation/native";
import { Text } from "@rneui/themed"

type EditContactScreenProps = StaticScreenProps<{
    contact?: Contact
}>;

const EditContactScreen = ({ route }: EditContactScreenProps) => {
    const contact = route.params?.contact
    return <Text>{contact ? 'Edit contact' : 'Add contact'}</Text>
}

export default EditContactScreen