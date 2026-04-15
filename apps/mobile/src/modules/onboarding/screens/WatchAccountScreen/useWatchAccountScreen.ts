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
    fetchAndPersistAccount,
    useAccountBalancesInvalidator,
} from '@perawallet/wallet-core-accounts'
import {
    isValidAlgorandAddress,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { generateOrderedUniqueId, logger } from '@perawallet/wallet-core-shared'
import { useNfdResolve } from '@hooks/useNfdResolve'

type UseWatchAccountScreenResult = {
    address: string
    resolvedAddress: string
    isValidAddress: boolean
    isDuplicateAddress: boolean
    isNfdResolved: boolean
    isNfdResolving: boolean
    nfdName: string | undefined
    handleAddressChange: (text: string) => void
    handleWatchAccount: () => void
}

export const useWatchAccountScreen = (): UseWatchAccountScreenResult => {
    const navigation = useAppNavigation()
    const accounts = useAllAccounts()
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const { network } = useNetwork()
    const { invalidate: invalidateAccountBalances } =
        useAccountBalancesInvalidator()
    const [address, setAddress] = useState('')

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

        // Eagerly pull the on-chain account info so the derived status can
        // upgrade this watch account to rekeyed immediately if its
        // auth-addr matches another wallet account. Any failure just falls
        // back to the background sync service's next tick.
        fetchAndPersistAccount(resolvedAddress, network)
            .then(() => invalidateAccountBalances())
            .catch(error => {
                logger.warn('Failed to prefetch watch account info', {
                    address: resolvedAddress,
                    network,
                    error:
                        error instanceof Error
                            ? { message: error.message, stack: error.stack }
                            : error,
                })
            })

        navigation.push('NameAccount', {
            account: newAccount as WalletAccount,
        })
    }, [
        resolvedAddress,
        isDuplicateAddress,
        accounts,
        setAccounts,
        navigation,
        network,
        invalidateAccountBalances,
    ])

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
