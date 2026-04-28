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

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import type { LedgerAccount } from '@perawallet/wallet-core-ledger'
import type { HardwareWalletTransport } from '@perawallet/wallet-core-hardware-wallet'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'
import { useLedgerConnection } from '../../hooks'
import { getLedgerErrorPreset } from '@modules/ledger/utils'
import type { Nullable } from '@perawallet/wallet-core-shared'

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
    isFetchingMore: boolean
    toggleSelection: (address: string) => void
    toggleSelectAll: () => void
    handleContinue: () => void
    handleFindAnother: () => Promise<void>
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerSelectAccountsScreen =
    (): UseLedgerSelectAccountsScreenResult => {
        const {
            params: { deviceId, deviceName, accounts: routeAccounts },
        } = useRoute<LedgerSelectAccountsRouteProp>()
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const allAccounts = useAllAccounts()
        const { errorToast } = useToast()
        const { connect } = useLedgerConnection()

        const [accounts, setAccounts] = useState<LedgerAccount[]>(routeAccounts)
        const [isFetchingMore, setIsFetchingMore] = useState(false)
        const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(
            () => new Set(),
        )

        const transportRef = useRef<Nullable<HardwareWalletTransport>>(null)
        const inFlightRef = useRef(false)
        const isMountedRef = useRef(true)
        const accountsRef = useRef<LedgerAccount[]>(routeAccounts)

        useEffect(() => {
            isMountedRef.current = true
            return () => {
                isMountedRef.current = false
            }
        }, [])

        useEffect(() => {
            accountsRef.current = accounts
        }, [accounts])

        useEffect(() => {
            return () => {
                transportRef.current?.disconnect().catch(() => {})
                transportRef.current = null
            }
        }, [])

        const alreadyImportedAddresses = useMemo(() => {
            return new Set(allAccounts.map(acc => acc.address))
        }, [allAccounts])

        const newAccounts = useMemo(() => {
            return accounts.filter(
                acc => !alreadyImportedAddresses.has(acc.address),
            )
        }, [accounts, alreadyImportedAddresses])

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

            if (selectedAccounts.length === 0) return

            navigation.navigate('LedgerVerify', {
                deviceId,
                deviceName,
                selectedAccounts,
            })
        }, [accounts, selectedAddresses, deviceId, deviceName, navigation])

        const handleFindAnother = useCallback(async () => {
            if (inFlightRef.current) return
            inFlightRef.current = true
            setIsFetchingMore(true)
            try {
                if (!transportRef.current) {
                    transportRef.current = await connect(deviceId)
                }

                const nextIndex =
                    accountsRef.current.reduce(
                        (max, acc) => Math.max(max, acc.accountIndex),
                        -1,
                    ) + 1

                const next = await transportRef.current.getAddress(
                    nextIndex,
                    false,
                )

                if (!isMountedRef.current) return

                setAccounts(prev => [...prev, next])
            } catch (err) {
                if (!isMountedRef.current) return
                const error =
                    err instanceof Error ? err : new Error(String(err))
                const preset = getLedgerErrorPreset(error, t)
                errorToast(preset.title, preset.body)
            } finally {
                inFlightRef.current = false
                if (isMountedRef.current) {
                    setIsFetchingMore(false)
                }
            }
        }, [connect, deviceId, errorToast, t])

        const areAllImported = newAccounts.length === 0
        const canContinue =
            !isFetchingMore && (areAllImported || selectedAddresses.size > 0)

        return {
            accounts,
            selectedAddresses,
            isAllSelected,
            areAllImported,
            canContinue,
            alreadyImportedAddresses,
            isFetchingMore,
            toggleSelection,
            toggleSelectAll,
            handleContinue,
            handleFindAnother,
            t,
        }
    }
