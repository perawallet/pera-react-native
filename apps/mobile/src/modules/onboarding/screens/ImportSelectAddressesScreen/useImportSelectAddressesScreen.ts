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

import { useState, useMemo, useCallback } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { OnboardingStackParamList } from '../../routes/types'
import {
    useAllAccounts,
    useAccountsStore,
    HDWalletAccount,
    discoverRekeyedAccounts,
    getSeedFromMasterKey,
    DerivationTypes,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useIsOnboarding } from '@modules/onboarding/hooks'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'

type ImportSelectAddressesRouteProp = RouteProp<
    OnboardingStackParamList,
    'ImportSelectAddresses'
>

export type UseImportSelectAddressesScreenResult = {
    accounts: HDWalletAccount[]
    selectedAddresses: Set<string>
    isAllSelected: boolean
    areAllImported: boolean
    canContinue: boolean
    isProcessing: boolean
    alreadyImportedAddresses: Set<string>
    toggleSelection: (address: string) => void
    toggleSelectAll: () => void
    handleContinue: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export function useImportSelectAddressesScreen(): UseImportSelectAddressesScreenResult {
    const {
        params: { accounts },
    } = useRoute<ImportSelectAddressesRouteProp>()
    const { t } = useLanguage()
    const allAccounts = useAllAccounts()
    const { getPrivateData } = useKMS()
    const navigation = useAppNavigation()

    const { setIsOnboarding } = useIsOnboarding()

    const alreadyImportedAddresses = useMemo(() => {
        return new Set(allAccounts.map(acc => acc.address))
    }, [allAccounts])

    const newAccounts = useMemo(() => {
        return accounts.filter(
            acc => !alreadyImportedAddresses.has(acc.address),
        )
    }, [accounts, alreadyImportedAddresses])

    const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(
        () => new Set(newAccounts.map(acc => acc.address)),
    )
    const [isProcessing, setIsProcessing] = useState(false)

    const isAllSelected =
        newAccounts.length > 0 && selectedAddresses.size === newAccounts.length

    const toggleSelection = useCallback(
        (address: string) => {
            if (alreadyImportedAddresses.has(address)) return

            setSelectedAddresses(prev => {
                const next = new Set(prev)
                if (next.has(address)) {
                    next.delete(address)
                } else {
                    next.add(address)
                }
                return next
            })
        },
        [alreadyImportedAddresses],
    )

    const toggleSelectAll = useCallback(() => {
        if (isAllSelected) {
            setSelectedAddresses(new Set())
        } else {
            setSelectedAddresses(new Set(newAccounts.map(acc => acc.address)))
        }
    }, [isAllSelected, newAccounts])

    const handleContinue = useCallback(async () => {
        setIsProcessing(true)

        deferToNextCycle(async () => {
            const accountsToAdd = accounts.filter(acc =>
                selectedAddresses.has(acc.address),
            )

            if (accountsToAdd.length > 0) {
                const { setAccounts } = useAccountsStore.getState()
                setAccounts([...allAccounts, ...accountsToAdd])
            }

            try {
                const walletId = accounts[0].hdWalletDetails.walletId
                const privateData = await getPrivateData(walletId)

                if (!privateData) {
                    setIsOnboarding(false)
                    setIsProcessing(false)
                    return
                }

                const seed = getSeedFromMasterKey(privateData)
                const discoveredRekeyedAccounts = await discoverRekeyedAccounts({
                    seed,
                    derivationType: DerivationTypes.Peikert,
                    walletId,
                    accountAddresses: accounts.map(a => a.address),
                })

                if (discoveredRekeyedAccounts.length === 0) {
                    setIsOnboarding(false)
                } else {
                    navigation.replace('ImportRekeyedAddresses', {
                        accounts: discoveredRekeyedAccounts,
                    })
                }
            } catch {
                setIsOnboarding(false)
            } finally {
                setIsProcessing(false)
            }
        })

    }, [
        accounts,
        selectedAddresses,
        allAccounts,
        getPrivateData,
        setIsOnboarding,
        navigation,
    ])

    const areAllImported = newAccounts.length === 0
    const canContinue = areAllImported || selectedAddresses.size > 0

    return {
        accounts,
        selectedAddresses,
        isAllSelected,
        areAllImported,
        canContinue,
        isProcessing,
        alreadyImportedAddresses,
        toggleSelection,
        toggleSelectAll,
        handleContinue,
        t,
    }
}
