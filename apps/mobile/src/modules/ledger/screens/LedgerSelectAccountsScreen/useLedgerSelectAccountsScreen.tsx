/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { type RouteProp, useRoute } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useAllAccounts,
    prefetchLedgerAccountPreview,
    useLedgerRekeyedScan,
    type LedgerSelectableAccount,
} from '@perawallet/wallet-core-accounts'
import {
    type LedgerAccount,
    LedgerProviderNotFoundError,
    classifyLedgerError,
    withLedgerConfirmationTimeout,
    withLedgerConnectionTimeout,
} from '@perawallet/wallet-core-ledger'
import type { HardwareWalletTransport } from '@perawallet/wallet-core-hardware-wallet'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    useAlgorandClient,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useIsMounted } from '@hooks/useIsMounted'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useAddressSelection } from '@hooks/useAddressSelection'
import { useBottomSheet } from '@modules/bottom-sheet'
import { LedgerAccountInfoContent } from '@modules/ledger/components/LedgerAccountInfoContent'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'
import { useExitAccountFlow } from '@modules/onboarding/hooks'
import {
    deserializeLedgerAccount,
    getLedgerErrorPreset,
    serializeSelectableAccount,
} from '@modules/ledger/utils'

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
        const isMounted = useIsMounted()
        const allAccounts = useAllAccounts()
        const { errorToast } = useToast()

        const queryClient = useQueryClient()
        const algokit = useAlgorandClient()
        const { network } = useNetwork()
        const { request } = useBottomSheet()
        const { exitAccountFlow } = useExitAccountFlow()

        const [accounts, setAccounts] = useState<LedgerAccount[]>(() =>
            routeAccounts.map(deserializeLedgerAccount),
        )
        const [isFetchingMore, setIsFetchingMore] = useState(false)

        const transportRef = useRef<Nullable<HardwareWalletTransport>>(null)
        const inFlightRef = useRef(false)
        const accountsRef = useRef<LedgerAccount[]>(accounts)
        // Network-scoped set of addresses already warmed, so growing the
        // list (Find another / rekeyed scan) only prefetches new addresses.
        const prefetchedRef = useRef<Set<string>>(new Set())

        useEffect(() => {
            accountsRef.current = accounts
        }, [accounts])

        useEffect(() => {
            return () => {
                transportRef.current?.disconnect().catch(() => {})
                transportRef.current = null
            }
        }, [])

        // Each entry in `prefetchedRef` is bound to a specific network — when
        // the active network changes, those entries no longer represent warm
        // caches, so reset and let the prefetch effect re-warm the list.
        useEffect(() => {
            prefetchedRef.current = new Set()
        }, [network])

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

        const areAllImported = newAccounts.length === 0

        const selectableAddresses = useMemo(
            () =>
                newAccounts.map(s =>
                    s.kind === 'derived' ? s.account.address : s.address,
                ),
            [newAccounts],
        )

        const {
            selectedAddresses,
            isAllSelected,
            toggle: toggleSelection,
            toggleSelectAll,
        } = useAddressSelection(selectableAddresses, {
            disabledAddresses: alreadyImportedAddresses,
        })

        const handleContinue = useCallback(() => {
            // Re-pairing a device whose accounts are all already imported
            // leaves nothing to select. Finish the flow instead of
            // dead-ending on an enabled-but-inert button.
            if (areAllImported) {
                exitAccountFlow()
                return
            }

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
                selectedAccounts: result.map(serializeSelectableAccount),
            })
        }, [
            areAllImported,
            exitAccountFlow,
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
                    const connectPromise = provider.connect(deviceId)
                    try {
                        transportRef.current =
                            await withLedgerConnectionTimeout(
                                connectPromise,
                                'Connect to Ledger',
                            )
                    } catch (connectError) {
                        // Release a transport that arrives after the timeout
                        // so the BLE link isn't held by a handle nobody owns.
                        connectPromise
                            .then(t => t.disconnect().catch(() => {}))
                            .catch(() => {})
                        throw connectError
                    }
                }

                const nextIndex =
                    accountsRef.current.reduce(
                        (max, acc) => Math.max(max, acc.accountIndex),
                        -1,
                    ) + 1

                // verify=true forces the user to confirm each derived address
                // on the Ledger before it's added to the import list, so a
                // wrong-device/wrong-address derivation can't be imported
                // silently.
                // display=true is an on-device confirmation — bound it by
                // the confirmation ceiling so a silent BLE drop can't wedge
                // the button in its loading state forever.
                const next = await withLedgerConfirmationTimeout(
                    transportRef.current.getAddress(nextIndex, true),
                    'Confirm Ledger address',
                )

                if (!isMounted()) return

                setAccounts(prev => [...prev, next])
            } catch (err) {
                // The lib caches one transport per device, so a handle that
                // just failed is likely wedged (dead link or busy exchange).
                // Release it and reconnect fresh on the next tap.
                transportRef.current?.disconnect().catch(() => {})
                transportRef.current = null
                if (!isMounted()) return
                const error = classifyLedgerError(err)
                const preset = getLedgerErrorPreset(error, t)
                errorToast(preset.title, preset.body)
            } finally {
                inFlightRef.current = false
                if (isMounted()) {
                    setIsFetchingMore(false)
                }
            }
        }, [deviceId, transportType, errorToast, t, isMounted])

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
                    options: { size: 'modal', enablePanDownToClose: true },
                })
            },
            [request, selectableByAddress, t],
        )

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
