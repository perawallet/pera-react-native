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
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'

type UseWatchAccountScreenResult = {
    address: string
    isValidAddress: boolean
    isDuplicateAddress: boolean
    handleAddressChange: (text: string) => void
    handleWatchAccount: () => void
}

export const useWatchAccountScreen = (): UseWatchAccountScreenResult => {
    const navigation = useAppNavigation()
    const accounts = useAllAccounts()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const [address, setAddress] = useState('')

    const isValidAddress = isValidAlgorandAddress(address)
    const isDuplicateAddress =
        isValidAddress && accounts.some(a => a.address === address)

    const handleAddressChange = useCallback((text: string) => {
        setAddress(text)
    }, [])

    const handleWatchAccount = useCallback(() => {
        if (!isValidAlgorandAddress(address) || isDuplicateAddress) {
            return
        }

        const newAccount = {
            id: generateOrderedUniqueId(),
            address,
            type: AccountTypes.watch,
        }

        setAccounts([...accounts, newAccount])
        navigation.push('NameAccount', {
            account: newAccount as WalletAccount,
        })
    }, [address, isDuplicateAddress, accounts, setAccounts, navigation])

    return {
        address,
        isValidAddress,
        isDuplicateAddress,
        handleAddressChange,
        handleWatchAccount,
    }
}
