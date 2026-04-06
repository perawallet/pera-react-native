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
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import type { LedgerAccount } from '@perawallet/wallet-core-ledger'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'

type LedgerSelectAccountsRouteProp = RouteProp<
    AddAccountStackParamList,
    'LedgerSelectAccounts'
>

type UseLedgerSelectAccountsScreenResult = {
    accounts: LedgerAccount[]
    selectedAddresses: Set<string>
    isAllSelected: boolean
    areAllImported: boolean
    canContinue: boolean
    alreadyImportedAddresses: Set<string>
    toggleSelection: (address: string) => void
    toggleSelectAll: () => void
    handleContinue: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerSelectAccountsScreen =
    (): UseLedgerSelectAccountsScreenResult => {
        const {
            params: { deviceId, deviceName, accounts },
        } = useRoute<LedgerSelectAccountsRouteProp>()
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const allAccounts = useAllAccounts()

        const alreadyImportedAddresses = useMemo(() => {
            return new Set(allAccounts.map(acc => acc.address))
        }, [allAccounts])

        const newAccounts = useMemo(() => {
            return accounts.filter(
                acc => !alreadyImportedAddresses.has(acc.address),
            )
        }, [accounts, alreadyImportedAddresses])

        const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(
            () => new Set(),
        )

        const isAllSelected =
            newAccounts.length > 0 &&
            selectedAddresses.size === newAccounts.length

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
                setSelectedAddresses(
                    new Set(newAccounts.map(acc => acc.address)),
                )
            }
        }, [isAllSelected, newAccounts])

        const handleContinue = useCallback(() => {
            const selectedAccounts = accounts.filter(acc =>
                selectedAddresses.has(acc.address),
            )

            navigation.navigate('LedgerVerify', {
                deviceId,
                deviceName,
                selectedAccounts,
            })
        }, [accounts, selectedAddresses, deviceId, deviceName, navigation])

        const areAllImported = newAccounts.length === 0
        const canContinue = areAllImported || selectedAddresses.size > 0

        return {
            accounts,
            selectedAddresses,
            isAllSelected,
            areAllImported,
            canContinue,
            alreadyImportedAddresses,
            toggleSelection,
            toggleSelectAll,
            handleContinue,
            t,
        }
    }
