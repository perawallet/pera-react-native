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

import { useCallback, useState } from 'react'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    useAccountsStore,
    useAllAccounts,
    AccountTypes,
} from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { v7 as uuidv7 } from 'uuid'

type UseWatchAccountScreenResult = {
    address: string
    isValidAddress: boolean
    handleAddressChange: (text: string) => void
    handleWatchAccount: () => void
}

export const useWatchAccountScreen = (): UseWatchAccountScreenResult => {
    const navigation = useAppNavigation()
    const accounts = useAllAccounts()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const setSelectedAccountAddress = useAccountsStore(
        state => state.setSelectedAccountAddress,
    )
    const { showToast } = useToast()
    const { t } = useLanguage()
    const [address, setAddress] = useState('')

    const isValidAddress = isValidAlgorandAddress(address)

    const handleAddressChange = useCallback((text: string) => {
        setAddress(text)
    }, [])

    const handleWatchAccount = useCallback(() => {
        if (!isValidAlgorandAddress(address)) {
            showToast({
                title: t('onboarding.watch_account.invalid_address'),
                body: '',
                type: 'error',
            })
            return
        }

        const alreadyExists = accounts.some(a => a.address === address)
        if (alreadyExists) {
            showToast({
                title: t('onboarding.watch_account.invalid_address'),
                body: '',
                type: 'error',
            })
            return
        }

        const newAccount = {
            id: uuidv7(),
            address,
            type: AccountTypes.watch,
            canSign: false,
        }

        setAccounts([...accounts, newAccount])
        setSelectedAccountAddress(address)

        showToast({
            title: t('onboarding.watch_account.success_title'),
            body: t('onboarding.watch_account.success_body'),
            type: 'success',
        })

        navigation.navigate('TabBar', { screen: 'Home' })
    }, [
        address,
        accounts,
        setAccounts,
        setSelectedAccountAddress,
        showToast,
        t,
        navigation,
    ])

    return {
        address,
        isValidAddress,
        handleAddressChange,
        handleWatchAccount,
    }
}
