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

import { useState, useMemo, useCallback, useEffect } from 'react'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import {
    useAllAccounts,
    useSetAccounts,
    useSelectedAccountAddress,
    HDWalletAccount,
    useAccountDiscovery,
    useHDImportSession,
    DerivationTypes,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useExitAccountFlow } from '@modules/onboarding/hooks'
import { OnboardingStackParamList } from '../../routes/types'

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
    handleBack: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export function useImportSelectAddressesScreen(): UseImportSelectAddressesScreenResult {
    const { params } = useRoute<ImportSelectAddressesRouteProp>()
    const { accounts } = params
    const isImportMode = 'mode' in params && params.mode === 'import'
    const importWalletKeyId = isImportMode ? params.walletKeyId : null

    const { t } = useLanguage()
    const allAccounts = useAllAccounts()
    const { discoverRekeyedAccounts } = useAccountDiscovery()
    const { commitImport, cancelImport } = useHDImportSession()
    const markBackupComplete = useMarkMnemonicBackupComplete()
    const navigation = useAppNavigation()
    const reactNavigation = useNavigation()

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
        () => new Set(newAccounts.length > 0 ? [newAccounts[0].address] : []),
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

            try {
                if (isImportMode && importWalletKeyId) {
                    if (accountsToAdd.length === 0) {
                        setIsProcessing(false)
                        return
                    }
                    // Commit: persists keystore root + appends selected
                    // accounts to the accounts store. After this returns the
                    // import session is cleared.
                    await commitImport({
                        walletKeyId: importWalletKeyId,
                        selectedAccounts: accountsToAdd,
                    })
                    markBackupComplete(accountsToAdd[0])
                    setSelectedAccountAddress(accountsToAdd[0].address)
                } else if (accountsToAdd.length > 0) {
                    setAccounts([...allAccounts, ...accountsToAdd])
                    setSelectedAccountAddress(accountsToAdd[0].address)
                }

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
        isImportMode,
        importWalletKeyId,
        commitImport,
        markBackupComplete,
        discoverRekeyedAccounts,
        exitAccountFlow,
        navigation,
        setSelectedAccountAddress,
        setAccounts,
    ])

    const handleBack = useCallback(() => {
        if (isImportMode) {
            cancelImport()
        }
        navigation.goBack()
    }, [isImportMode, cancelImport, navigation])

    useEffect(() => {
        if (!isImportMode) return
        const unsub = reactNavigation.addListener('beforeRemove', () => {
            // Only trigger cancellation when leaving without committing.
            if (!isProcessing) {
                cancelImport()
            }
        })
        return unsub
    }, [isImportMode, reactNavigation, isProcessing, cancelImport])

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
        handleBack,
        t,
    }
}
