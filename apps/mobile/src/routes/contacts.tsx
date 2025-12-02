import { createNativeStackNavigator, NativeStackHeaderProps } from "@react-navigation/native-stack";
import { SCREEN_ANIMATION_CONFIG } from "../constants/ui";
import { screenListeners } from "./listeners";
import NavigationHeader from "../components/common/navigation-header/NavigationHeader";
import ContactListScreen from "../modules/contacts/screens/ContactListScreen";
import ContactListHeaderButtons from "../modules/contacts/components/ContactListHeaderButtons";
import ViewContactHeaderButtons from "../modules/contacts/components/ViewContactHeaderButtons";
import ViewContactScreen from "../modules/contacts/screens/ViewContactScreen";
import EditContactScreen from "../modules/contacts/screens/EditContactScreen";
import { headeredLayout } from "./layouts";

export const ContactsStack = createNativeStackNavigator({
    initialRouteName: 'ContactsList',
    screenOptions: {
        headerShown: true,
        header: (props: NativeStackHeaderProps) => (
            <NavigationHeader {...props} />
        ),
        ...SCREEN_ANIMATION_CONFIG,
    },
    layout: headeredLayout,
    screenListeners,
    screens: {
        ContactsList: {
            screen: ContactListScreen,
            options: {
                title: 'Contacts',
                headerRight: () => <ContactListHeaderButtons />,
            },
        },
        ViewContact: {
            screen: ViewContactScreen,
            options: () => ({
                title: 'View Contact',
                headerRight: () => <ViewContactHeaderButtons />,
            }),
        },
        EditContact: {
            screen: EditContactScreen,
            options: () => ({
                title: 'Edit Contact',
            }),
        },
        AddContact: {
            screen: EditContactScreen,
            options: () => ({
                title: 'Add New Contact',
            }),
        },
    },
})