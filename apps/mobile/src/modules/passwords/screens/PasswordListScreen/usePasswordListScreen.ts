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

import { useCallback } from 'react'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { usePasskeyAutofillStatus } from '@perawallet/wallet-core-passkeys'
import { useLoginsQuery, type Login } from '@perawallet/wallet-core-passwords'
import { openCredentialProviderSettings } from '@modules/settings/screens/SettingsPasskeysScreen/openCredentialProviderSettings'

export type UsePasswordListScreenResult = {
    logins: Login[]
    isLoading: boolean
    isProviderActive: boolean
    handleAdd: () => void
    handleSelect: (id: string) => void
    handleEnableProvider: () => void
}

export const usePasswordListScreen = (): UsePasswordListScreenResult => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { logins, isLoading } = useLoginsQuery()
    const { isProviderActive, openProviderSettings } =
        usePasskeyAutofillStatus()

    const handleAdd = useCallback(() => {
        navigation.navigate('AddPassword')
    }, [navigation])

    const handleSelect = useCallback(
        (id: string) => {
            navigation.navigate('ViewPassword', { id })
        },
        [navigation],
    )

    const handleEnableProvider = useCallback(() => {
        void openCredentialProviderSettings(openProviderSettings)
    }, [openProviderSettings])

    return {
        logins,
        isLoading,
        isProviderActive,
        handleAdd,
        handleSelect,
        handleEnableProvider,
    }
}
