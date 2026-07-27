/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { type NativeStackHeaderProps } from '@react-navigation/native-stack'
import { createAppStackNavigator } from '@routes/createAppStackNavigator'
import { SCREEN_ANIMATION_CONFIG } from '@constants/ui'
import { NavigationHeader } from '@components/NavigationHeader'
import { ContactListScreen } from '@modules/contacts/screens/ContactListScreen'
import { ViewContactScreen } from '@modules/contacts/screens/ViewContactScreen'
import { EditContactScreen } from '@modules/contacts/screens/EditContactScreen'
import { AddContactScreen } from '@modules/contacts/screens/AddContactScreen'
import { fullScreenLayout } from '@layouts/index'
import { screenListeners } from '@routes/listeners'

export type ContactsStackParamsList = {
    ContactsList: undefined
    ViewContact: undefined
    // Forwarded by ADD_CONTACT / EDIT_CONTACT deeplinks and by the
    // AccountActions sheet so the form can prefill the address+label.
    EditContact: { address?: string; label?: string } | undefined
    AddContact: { address?: string; label?: string } | undefined
}

const ContactsStack = createAppStackNavigator<ContactsStackParamsList>()

export const ContactsStackNavigator = () => {
    return (
        <ContactsStack.Navigator
            initialRouteName='ContactsList'
            screenOptions={{
                headerShown: true,
                header: (props: NativeStackHeaderProps) => (
                    <NavigationHeader {...props} />
                ),
                ...SCREEN_ANIMATION_CONFIG,
            }}
            screenListeners={screenListeners}
            layout={fullScreenLayout}
        >
            <ContactsStack.Screen
                name='ContactsList'
                options={{
                    title: 'screens.contacts',
                }}
                component={ContactListScreen}
            />
            <ContactsStack.Screen
                name='ViewContact'
                options={{
                    title: '',
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
                component={AddContactScreen}
            />
        </ContactsStack.Navigator>
    )
}
