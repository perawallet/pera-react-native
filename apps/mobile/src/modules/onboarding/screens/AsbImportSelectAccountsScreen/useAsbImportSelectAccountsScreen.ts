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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from 'react-native'
import {
    DuplicateAccountError,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    partitionImportableAccounts,
    useAsbAccountImport,
    type AsbBackupAccount,
} from '@perawallet/wallet-core-backup'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useAsbImportFlowStore } from '@modules/onboarding/hooks'

export type AsbAccountListItem = AsbBackupAccount & {
    isAlreadyImported: boolean
}

type UseAsbImportSelectAccountsScreenResult = {
    items: AsbAccountListItem[]
    selectedAddresses: Set<string>
    canContinue: boolean
    isProcessing: boolean
    isAllSelected: boolean
    areAllImported: boolean
    importableCount: number
    toggleSelection: (address: string) => void
    toggleSelectAll: () => void
    handleContinue: () => Promise<void>
}

export const useAsbImportSelectAccountsScreen =
    (): UseAsbImportSelectAccountsScreenResult => {
        const navigation = useAppNavigation()
        const { t } = useLanguage()
        const { errorToast } = useToast()
        const payload = useAsbImportFlowStore(state => state.payload)
        const selected = useAsbImportFlowStore(state => state.selectedAddresses)
        const setSelection = useAsbImportFlowStore(state => state.setSelection)
        const toggle = useAsbImportFlowStore(state => state.toggleSelection)
        const reset = useAsbImportFlowStore(state => state.reset)
        const allAccounts = useAllAccounts()
        const { importAccount } = useAsbAccountImport()

        const [isProcessing, setIsProcessing] = useState(false)

        // Refs so the AppState handler and unmount cleanup see the latest
        // values without re-subscribing on every render.
        const resetRef = useRef(reset)
        resetRef.current = reset
        // Shared across handleContinue's loop and the AppState handler so
        // a mid-flight background can break the loop before the next
        // iteration reads a now-wiped privateKey buffer.
        const cancelledRef = useRef(false)

        // While the user is on this screen the decrypted ASB payload (one
        // 32- or 64-byte private key per selected account) is live in the
        // flow store. Backgrounding the app or popping the screen without
        // confirming must wipe those buffers in place — Android can keep
        // RN alive for minutes-to-hours, plenty of time for a heap dumper
        // on a rooted device.
        useEffect(() => {
            cancelledRef.current = false
            const appStateSub = AppState.addEventListener('change', state => {
                if (state !== 'active') {
                    cancelledRef.current = true
                    resetRef.current()
                }
            })
            return () => {
                appStateSub.remove()
                // Cleanup covers system back, navigator preemption, and
                // force-quit recovery. After a successful import the loop
                // already reset the store, so this is a no-op.
                resetRef.current()
            }
        }, [])

        // Partition once per change. `unsupported` is dropped silently to
        // match the iOS/Android flows; surfacing invalid-address rows in the
        // selection list would just confuse the user.
        const { items, importableAddresses } = useMemo(() => {
            if (!payload) {
                return {
                    items: [] as AsbAccountListItem[],
                    importableAddresses: new Set<string>(),
                }
            }
            const partition = partitionImportableAccounts(
                payload.accounts,
                allAccounts,
            )
            const importableSet = new Set(
                partition.importable.map(a => a.address),
            )
            const merged: AsbAccountListItem[] = [
                ...partition.importable.map(a => ({
                    ...a,
                    isAlreadyImported: false,
                })),
                ...partition.alreadyImported.map(a => ({
                    ...a,
                    isAlreadyImported: true,
                })),
            ]
            return { items: merged, importableAddresses: importableSet }
        }, [payload, allAccounts])

        const selectedSet = useMemo(() => {
            const importableSelected = selected.filter(addr =>
                importableAddresses.has(addr),
            )
            return new Set(importableSelected)
        }, [selected, importableAddresses])

        const importableCount = importableAddresses.size
        const areAllImported = importableCount === 0 && items.length > 0
        const isAllSelected =
            importableCount > 0 && selectedSet.size === importableCount

        const toggleSelectAll = useCallback(() => {
            if (isAllSelected) {
                setSelection([])
            } else {
                setSelection(Array.from(importableAddresses))
            }
        }, [isAllSelected, importableAddresses, setSelection])

        const handleContinue = useCallback(async () => {
            if (!payload || selectedSet.size === 0 || isProcessing) return

            setIsProcessing(true)
            try {
                let importedCount = 0
                let skippedDuplicateCount = 0
                let failedCount = 0

                // Build the list of selected accounts to import, in the
                // order they appear in the payload.
                const toImport = payload.accounts.filter(a =>
                    selectedSet.has(a.address),
                )

                for (const account of toImport) {
                    if (cancelledRef.current) return
                    try {
                        await importAccount(account)
                        importedCount += 1
                    } catch (e) {
                        if (e instanceof DuplicateAccountError) {
                            // Race: another tab/session imported it after we
                            // built the selection list. Count it as skipped
                            // instead of failed.
                            skippedDuplicateCount += 1
                            continue
                        }
                        failedCount += 1
                        logger.error('ASB account import failed', {
                            error: e,
                            address: account.address,
                        })
                    } finally {
                        // Wipe the seed bytes the instant we're done with
                        // them. The shared importFromSeed hook operates on
                        // its own slice(0, 32) copy, so zeroing the
                        // original buffer here is safe and bounds the
                        // in-memory window to a single iteration.
                        zeroBytes(account.privateKey)
                        account.privateKey = null
                    }
                }

                if (cancelledRef.current) return
                // Wipe whatever the store still holds (the QR-equivalent
                // envelope reference, plus any unselected accounts' seeds)
                // before navigating. The result screen only needs aggregate
                // counts, which are passed via route params.
                resetRef.current()
                navigation.replace('AsbImportResult', {
                    importedCount,
                    skippedDuplicateCount,
                    failedCount,
                })
            } catch (e) {
                logger.error('ASB import batch failed unexpectedly', {
                    error: e,
                })
                errorToast(
                    t('onboarding.asb_import.select.errors.title'),
                    t('onboarding.asb_import.select.errors.body'),
                )
            } finally {
                setIsProcessing(false)
            }
        }, [
            payload,
            selectedSet,
            isProcessing,
            importAccount,
            navigation,
            errorToast,
            t,
        ])

        return {
            items,
            selectedAddresses: selectedSet,
            canContinue: selectedSet.size > 0 && !isProcessing,
            isProcessing,
            isAllSelected,
            areAllImported,
            importableCount,
            toggleSelection: toggle,
            toggleSelectAll,
            handleContinue,
        }
    }
