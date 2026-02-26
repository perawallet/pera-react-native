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
    useSetAccounts,
    useSelectedAccountAddress,
    HDWalletAccount,
    useAccountDiscovery,
    DerivationTypes,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useExitAccountFlow } from '@modules/onboarding/hooks'
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
    const { discoverRekeyedAccounts } = useAccountDiscovery()
    const navigation = useAppNavigation()

    const { exitAccountFlow } = useExitAccountFlow()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { setAccounts } = useSetAccounts()

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
                setAccounts([...allAccounts, ...accountsToAdd])
                setSelectedAccountAddress(accountsToAdd[0].address)
            }

            try {
                const walletKeyId = accounts[0].keyPairId
                const discoveredRekeyedAccounts = await discoverRekeyedAccounts(
                    {
                        walletKeyId,
                        derivationType: DerivationTypes.Peikert,
                        accountAddresses: accounts.map(a => a.address),
                    },
                )

                if (!discoveredRekeyedAccounts) {
                    exitAccountFlow()
                    setIsProcessing(false)
                    return
                }

                if (discoveredRekeyedAccounts.length === 0) {
                    exitAccountFlow()
                } else {
                    navigation.replace('ImportRekeyedAddresses', {
                        accounts: discoveredRekeyedAccounts,
                    })
                }
            } catch {
                exitAccountFlow()
            } finally {
                setIsProcessing(false)
            }
        })
    }, [
        accounts,
        selectedAddresses,
        allAccounts,
        discoverRekeyedAccounts,
        exitAccountFlow,
        navigation,
        setSelectedAccountAddress,
        setAccounts,
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
