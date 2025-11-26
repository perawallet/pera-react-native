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

import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useContacts } from '@perawallet/wallet-core-contacts'
import PWIcon from '../../../components/common/icons/PWIcon'

const ContactListHeaderButtons = () => {
    const { setSelectedContact } = useContacts()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const goToAdd = () => {
        setSelectedContact(null)
        navigation.navigate('AddContact')
    }

    return (
        <PWIcon
            name='plus'
            onPress={goToAdd}
        />
    )
}

export default ContactListHeaderButtons
