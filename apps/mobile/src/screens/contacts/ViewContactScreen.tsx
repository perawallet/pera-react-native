import EmptyView from "../../components/common/empty-view/EmptyView";
import PeraView from "../../components/common/view/PeraView";
import { Contact } from "@perawallet/core";
import { StaticScreenProps } from "@react-navigation/native";
import { Text } from "@rneui/themed"
import { useStyles } from "./ViewContactScreen.styles";
import ContactAvatar from "../../components/common/contact-avatar/ContactAvatar";

type ViewContactScreenProps = StaticScreenProps<{
    contact: Contact
}>;

const ViewContactScreen = ({ route }: ViewContactScreenProps) => {
    const contact = route.params?.contact
    const styles = useStyles()

    if (!contact) {
        return <EmptyView title="No contact found" body="Something appears to have gone wrong.  Couldn't find the contact specified" />
    }

    return <PeraView>
        <ContactAvatar contact={contact} size="large" />
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{contact.name}</Text>
        <Text style={styles.label}>Address</Text>
        <Text style={styles.value}>{contact.address}</Text>
    </PeraView>
}

export default ViewContactScreen