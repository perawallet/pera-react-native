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

import {
    createNativeStackNavigator,
    NativeStackHeaderProps,
} from '@react-navigation/native-stack'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import NavigationHeader from '@components/navigation-header/NavigationHeader'
import ContactListScreen from '@modules/contacts/screens/ContactListScreen'
import ContactListHeaderButtons from '@modules/contacts/components/ContactListHeaderButtons'
import ViewContactHeaderButtons from '@modules/contacts/components/ViewContactHeaderButtons'
import ViewContactScreen from '@modules/contacts/screens/ViewContactScreen'
import EditContactScreen from '@modules/contacts/screens/EditContactScreen'
import { headeredLayout } from '@layouts/index'

export type ContactsStackParamsList = {
    ContactsList: undefined
    ViewContact: undefined
    EditContact: undefined
    AddContact: undefined
}

const ContactsStack = createNativeStackNavigator<ContactsStackParamsList>()

export const ContactsStackNavigator = () => {
    return (
        <ContactsStack.Navigator
            initialRouteName='ContactsList'
            layout={headeredLayout}
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
        >
            <ContactsStack.Screen
                name='ContactsList'
                options={{
                    title: 'screens.contacts',
                    headerRight: () => <ContactListHeaderButtons />,
                }}
                component={ContactListScreen}
            />
            <ContactsStack.Screen
                name='ViewContact'
                options={{
                    title: 'screens.view_contact',
                    headerRight: () => <ViewContactHeaderButtons />,
                }}
                component={ViewContactScreen}
            />
            <ContactsStack.Screen
                name='EditContact'
                options={{
                    title: 'screens.edit_contact',
                }}
                component={EditContactScreen}
            />
            <ContactsStack.Screen
                name='AddContact'
                options={{
                    title: 'screens.add_contact',
                }}
                component={EditContactScreen}
            />
        </ContactsStack.Navigator>
    )
}
