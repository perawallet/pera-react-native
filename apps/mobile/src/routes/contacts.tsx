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
import { screenListeners } from './listeners'
import NavigationHeader from '@components/common/navigation-header/NavigationHeader'
import ContactListScreen from '@modules/contacts/screens/ContactListScreen'
import ContactListHeaderButtons from '@modules/contacts/components/ContactListHeaderButtons'
import ViewContactHeaderButtons from '@modules/contacts/components/ViewContactHeaderButtons'
import ViewContactScreen from '@modules/contacts/screens/ViewContactScreen'
import EditContactScreen from '@modules/contacts/screens/EditContactScreen'
import { headeredLayout } from './layouts'

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
                title: 'screens.contacts',
                headerRight: () => <ContactListHeaderButtons />,
            },
        },
        ViewContact: {
            screen: ViewContactScreen,
            options: () => ({
                title: 'screens.view_contact',
                headerRight: () => <ViewContactHeaderButtons />,
            }),
        },
        EditContact: {
            screen: EditContactScreen,
            options: () => ({
                title: 'screens.edit_contact',
            }),
        },
        AddContact: {
            screen: EditContactScreen,
            options: () => ({
                title: 'screens.add_contact',
            }),
        },
    },
})
