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
import {
    type ParamListBase,
    useFocusEffect,
    useNavigation,
} from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    usePasskeyAutofillStatus,
    useAutofillServiceStatus,
    type AutofillServiceStatus,
} from '@perawallet/wallet-core-passkeys'
import { useLoginsQuery, type Login } from '@perawallet/wallet-core-passwords'
import { openCredentialProviderSettings } from '@modules/settings/screens/SettingsPasskeysScreen/openCredentialProviderSettings'

export type UsePasswordListScreenResult = {
    logins: Login[]
    isLoading: boolean
    isProviderActive: boolean
    autofillStatus: AutofillServiceStatus
    handleAdd: () => void
    handleSelect: (id: string) => void
    handleEnableProvider: () => void
    handleEnableAutofill: () => void
}

export const usePasswordListScreen = (): UsePasswordListScreenResult => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { logins, isLoading } = useLoginsQuery()
    const {
        isProviderActive,
        openProviderSettings,
        refresh: refreshProviderStatus,
    } = usePasskeyAutofillStatus()
    const {
        status: autofillStatus,
        refresh: refreshAutofillStatus,
        openAutofillSettings,
    } = useAutofillServiceStatus()

    // Both statuses are system settings the user changes outside the app, so
    // the query cache is stale the moment they leave. Refetch on focus or the
    // banner keeps offering an action the user has already taken.
    useFocusEffect(
        useCallback(() => {
            refreshProviderStatus()
            refreshAutofillStatus()
        }, [refreshProviderStatus, refreshAutofillStatus]),
    )

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

    const handleEnableAutofill = useCallback(() => {
        void openAutofillSettings()
    }, [openAutofillSettings])

    return {
        logins,
        isLoading,
        isProviderActive,
        autofillStatus,
        handleAdd,
        handleSelect,
        handleEnableProvider,
        handleEnableAutofill,
    }
}
