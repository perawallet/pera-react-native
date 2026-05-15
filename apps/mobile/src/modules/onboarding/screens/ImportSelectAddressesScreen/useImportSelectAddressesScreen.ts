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

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native'
import {
    useAllAccounts,
    useSetAccounts,
    useSelectedAccountAddress,
    HDWalletAccount,
    useAccountDiscovery,
    useHDImportSession,
    DerivationTypes,
    isHDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { deferToNextCycle, logger } from '@perawallet/wallet-core-shared'
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
    const hasCommittedRef = useRef(false)

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
            const selected = accounts.filter(acc =>
                selectedAddresses.has(acc.address),
            )

            // Discovery returns HDWalletAccount objects without entropyKeyId.
            // Stamp each one from a sibling under the SAME keyPairId — either
            // one already in the store or another selected account. Looking
            // up per account (rather than off accounts[0]) keeps mixed-wallet
            // imports correct: each address only inherits from its own group.
            // Store siblings are scanned first so they take priority over
            // selected ones (single Map, first writer wins).
            const entropyByWalletId = new Map<string, string>()
            const sources = [
                ...allAccounts.filter(isHDWalletAccount),
                ...selected,
            ]
            for (const a of sources) {
                if (a.entropyKeyId && !entropyByWalletId.has(a.keyPairId)) {
                    entropyByWalletId.set(a.keyPairId, a.entropyKeyId)
                }
            }

            const accountsToAdd = selected.map(acc => {
                if (acc.entropyKeyId) return acc
                const inherited = entropyByWalletId.get(acc.keyPairId)
                return inherited ? { ...acc, entropyKeyId: inherited } : acc
            })

            try {
                if (isImportMode && importWalletKeyId) {
                    if (accountsToAdd.length > 0) {
                        // Commit: persists keystore root + appends selected
                        // accounts to the accounts store. After this returns
                        // the import session is cleared.
                        await commitImport({
                            walletKeyId: importWalletKeyId,
                            selectedAccounts: accountsToAdd,
                        })
                        hasCommittedRef.current = true
                        setSelectedAccountAddress(accountsToAdd[0].address)
                    } else {
                        // Re-import path: every selected address was already in
                        // the store, so there's nothing to commit but the
                        // session still proved possession and must not be
                        // cancelled by the beforeRemove listener.
                        hasCommittedRef.current = true
                    }
                    // Re-entering the mnemonic proves possession, so mark the
                    // wallet's keyPairId as backed up regardless of whether
                    // any new addresses were actually added — re-imports
                    // (every discovered address already in the store) and
                    // accounts created before this feature shipped both rely
                    // on this path to clear the backup banner.
                    const accountToMark =
                        accountsToAdd[0] ??
                        allAccounts.find(a => a.keyPairId === importWalletKeyId)
                    if (accountToMark) markBackupComplete(accountToMark)
                } else if (accountsToAdd.length > 0) {
                    setAccounts([...allAccounts, ...accountsToAdd])
                    setSelectedAccountAddress(accountsToAdd[0].address)
                }

                const walletKeyId = accounts[0].keyPairId
                // Only scan addresses the wallet actually holds after this
                // step: the freshly imported selection plus HD siblings
                // already in the store. Scanning unselected discovered
                // addresses would let the user persist watch accounts
                // rekeyed to an auth address we don't hold — non-signable
                // accounts produced by a possession-proven flow.
                const scanAddresses = [
                    ...new Set([
                        ...accountsToAdd.map(a => a.address),
                        ...allAccounts
                            .filter(isHDWalletAccount)
                            .filter(a => a.keyPairId === walletKeyId)
                            .map(a => a.address),
                    ]),
                ]
                const discoveredRekeyedAccounts = await discoverRekeyedAccounts(
                    {
                        walletKeyId,
                        derivationType: DerivationTypes.Peikert,
                        accountAddresses: scanAddresses,
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
            } catch (error) {
                logger.error('Account import flow failed', {
                    source: 'useImportSelectAddressesScreen',
                    isImportMode,
                    error,
                })
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

    useEffect(() => {
        if (!isImportMode) return
        const unsub = reactNavigation.addListener('beforeRemove', () => {
            // beforeRemove fires after navigation.replace too, so guard on a
            // commit flag rather than isProcessing (which the success path
            // resets in finally before this listener runs).
            if (!hasCommittedRef.current) {
                cancelImport()
            }
        })
        return unsub
    }, [isImportMode, reactNavigation, cancelImport])

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
