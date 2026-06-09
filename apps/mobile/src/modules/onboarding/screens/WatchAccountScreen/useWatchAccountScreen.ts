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
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    useAccountsStore,
    useAllAccounts,
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { isValidAlgorandAddress } from '@perawallet/wallet-core-blockchain'
import { trackEvent, OnboardingEvent } from '@analytics'
import {
    generateOrderedUniqueId,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { useNfdResolve } from '@hooks/useNfdResolve'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'

type UseWatchAccountScreenResult = {
    address: string
    resolvedAddress: string
    isValidAddress: boolean
    isDuplicateAddress: boolean
    isNfdResolved: boolean
    isNfdResolving: boolean
    nfdName: Optional<string>
    handleAddressChange: (text: string) => void
    handleWatchAccount: () => void
}

export const useWatchAccountScreen = (): UseWatchAccountScreenResult => {
    const navigation = useAppNavigation()
    const route =
        useRoute<RouteProp<AddAccountStackParamList, 'WatchAccount'>>()
    const accounts = useAllAccounts()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const [address, setAddress] = useState(route.params?.prefillAddress ?? '')

    const { resolvedAddress, isNfdResolved, isNfdResolving, nfdName } =
        useNfdResolve(address)

    const isValidAddress = isValidAlgorandAddress(resolvedAddress)
    const isDuplicateAddress =
        isValidAddress && accounts.some(a => a.address === resolvedAddress)

    const handleAddressChange = useCallback((text: string) => {
        setAddress(text)
    }, [])

    const handleWatchAccount = useCallback(() => {
        if (!isValidAlgorandAddress(resolvedAddress) || isDuplicateAddress) {
            return
        }

        const newAccount = {
            id: generateOrderedUniqueId(),
            address: resolvedAddress,
            type: AccountTypes.watch,
        }

        setAccounts([...accounts, newAccount])
        trackEvent(OnboardingEvent.WatchAccountComplete)
        navigation.push('NameAccount', {
            account: newAccount as WalletAccount,
        })
    }, [resolvedAddress, isDuplicateAddress, accounts, setAccounts, navigation])

    return {
        address,
        resolvedAddress,
        isValidAddress,
        isDuplicateAddress,
        isNfdResolved,
        isNfdResolving,
        nfdName,
        handleAddressChange,
        handleWatchAccount,
    }
}
