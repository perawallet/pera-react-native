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

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { RouteProp, useRoute } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useAllAccounts,
    prefetchLedgerAccountPreview,
    useLedgerRekeyedScan,
    type LedgerSelectableAccount,
} from '@perawallet/wallet-core-accounts'
import type { LedgerAccount } from '@perawallet/wallet-core-ledger'
import {
    LedgerProviderNotFoundError,
    classifyLedgerError,
} from '@perawallet/wallet-core-ledger'
import type { HardwareWalletTransport } from '@perawallet/wallet-core-hardware-wallet'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useBottomSheet } from '@modules/bottom-sheet'
import { LedgerAccountInfoContent } from '@modules/ledger/components/LedgerAccountInfoContent'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'
import { getLedgerErrorPreset } from '@modules/ledger/utils'

type LedgerSelectAccountsRouteProp = RouteProp<
    AddAccountStackParamList,
    'LedgerSelectAccounts'
>

type UseLedgerSelectAccountsScreenResult = {
    selectableAccounts: LedgerSelectableAccount[]
    isScanning: boolean
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
    handleInfoPress: (address: string, accountIndex: number) => void
    t: (key: string, options?: Record<string, unknown>) => string
}

export const useLedgerSelectAccountsScreen =
    (): UseLedgerSelectAccountsScreenResult => {
        const {
            params: {
                deviceId,
                deviceName,
                transportType = 'ble',
                accounts: routeAccounts,
            },
        } = useRoute<LedgerSelectAccountsRouteProp>()
        const { t } = useLanguage()
        const navigation = useAppNavigation()
        const allAccounts = useAllAccounts()
        const { errorToast } = useToast()

        const queryClient = useQueryClient()
        const algokit = useAlgorandClient()
        const { network } = useNetwork()
        const { request } = useBottomSheet()

        const [accounts, setAccounts] = useState<LedgerAccount[]>(routeAccounts)
        const [isFetchingMore, setIsFetchingMore] = useState(false)
        const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(
            () => new Set(),
        )

        const transportRef = useRef<Nullable<HardwareWalletTransport>>(null)
        const inFlightRef = useRef(false)
        const isMountedRef = useRef(true)
        const accountsRef = useRef<LedgerAccount[]>(routeAccounts)
        // Network-scoped set of addresses already warmed, so growing the
        // list (Find another / rekeyed scan) only prefetches new addresses.
        const prefetchedRef = useRef<Set<string>>(new Set())

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

        const { rekeyed, isScanning } = useLedgerRekeyedScan(accounts)

        const selectableAccounts = useMemo<LedgerSelectableAccount[]>(
            () => [
                ...accounts.map(
                    (account): LedgerSelectableAccount => ({
                        kind: 'derived',
                        account,
                    }),
                ),
                ...rekeyed,
            ],
            [accounts, rekeyed],
        )

        useEffect(() => {
            for (const selectable of selectableAccounts) {
                const address =
                    selectable.kind === 'derived'
                        ? selectable.account.address
                        : selectable.address
                const key = `${network}:${address}`
                if (prefetchedRef.current.has(key)) continue
                prefetchedRef.current.add(key)
                void prefetchLedgerAccountPreview(
                    queryClient,
                    algokit,
                    address,
                    network,
                )
            }
        }, [selectableAccounts, queryClient, algokit, network])

        const selectableByAddress = useMemo(() => {
            const m = new Map<string, LedgerSelectableAccount>()
            for (const s of selectableAccounts) {
                m.set(s.kind === 'derived' ? s.account.address : s.address, s)
            }
            return m
        }, [selectableAccounts])

        const alreadyImportedAddresses = useMemo(() => {
            return new Set(allAccounts.map(acc => acc.address))
        }, [allAccounts])

        const newAccounts = useMemo(() => {
            return selectableAccounts.filter(
                s =>
                    !alreadyImportedAddresses.has(
                        s.kind === 'derived' ? s.account.address : s.address,
                    ),
            )
        }, [selectableAccounts, alreadyImportedAddresses])

        const isAllSelected =
            newAccounts.length > 0 &&
            newAccounts.every(s =>
                selectedAddresses.has(
                    s.kind === 'derived' ? s.account.address : s.address,
                ),
            )

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
                    new Set(
                        newAccounts.map(s =>
                            s.kind === 'derived'
                                ? s.account.address
                                : s.address,
                        ),
                    ),
                )
            }
        }, [isAllSelected, newAccounts])

        const handleContinue = useCallback(() => {
            const selected = selectableAccounts.filter(s =>
                selectedAddresses.has(
                    s.kind === 'derived' ? s.account.address : s.address,
                ),
            )

            if (selected.length === 0) return

            const result: LedgerSelectableAccount[] = [...selected]
            const present = new Set(
                selected.map(s =>
                    s.kind === 'derived' ? s.account.address : s.address,
                ),
            )
            for (const s of selected) {
                if (
                    s.kind === 'rekeyed' &&
                    !present.has(s.authAccount.address)
                ) {
                    present.add(s.authAccount.address)
                    result.push({ kind: 'derived', account: s.authAccount })
                }
            }

            navigation.navigate('LedgerVerify', {
                deviceId,
                deviceName,
                transportType,
                selectedAccounts: result,
            })
        }, [
            selectableAccounts,
            selectedAddresses,
            deviceId,
            deviceName,
            transportType,
            navigation,
        ])

        const handleFindAnother = useCallback(async () => {
            if (inFlightRef.current) return
            inFlightRef.current = true
            setIsFetchingMore(true)
            try {
                if (!transportRef.current) {
                    const provider =
                        getProvider().hardwareWalletRegistry.getProvider(
                            'ledger',
                            transportType,
                        )
                    if (!provider) {
                        throw new LedgerProviderNotFoundError(
                            `No Ledger provider registered for transport "${transportType}"`,
                        )
                    }
                    transportRef.current = await provider.connect(deviceId)
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
                const error = classifyLedgerError(err)
                const preset = getLedgerErrorPreset(error, t)
                errorToast(preset.title, preset.body)
            } finally {
                inFlightRef.current = false
                if (isMountedRef.current) {
                    setIsFetchingMore(false)
                }
            }
        }, [deviceId, transportType, errorToast, t])

        const handleInfoPress = useCallback(
            (address: string, accountIndex: number) => {
                const selectable = selectableByAddress.get(address)
                const title =
                    selectable?.kind === 'rekeyed'
                        ? t('ledger.select_accounts.rekeyed_account_title')
                        : undefined
                void request({
                    contents: (
                        <LedgerAccountInfoContent
                            address={address}
                            accountIndex={accountIndex}
                            title={title}
                        />
                    ),
                    options: { size: 'lg' },
                })
            },
            [request, selectableByAddress, t],
        )

        const areAllImported = newAccounts.length === 0
        const canContinue =
            !isFetchingMore && (areAllImported || selectedAddresses.size > 0)

        return {
            selectableAccounts,
            isScanning,
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
            handleInfoPress,
            t,
        }
    }
