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

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
    type RouteProp,
    useNavigation,
    useRoute,
} from '@react-navigation/native'
import {
    useAccountsStore,
    useAllAccounts,
    useSetAccounts,
    useSelectedAccountAddress,
    type HDWalletAccount,
    useHDImportSession,
    isHDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { useKMS } from '@perawallet/wallet-core-kms'
import { deferToNextCycle, logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useAddressSelection } from '@hooks/useAddressSelection'
import { useToast } from '@hooks/useToast'
import {
    useExitAccountFlow,
    useRekeyScanNotice,
    REKEY_SCAN_UNAVAILABLE,
} from '@modules/onboarding/hooks'
import { type OnboardingStackParamList } from '../../routes/types'

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
    const { showToast } = useToast()
    const allAccounts = useAllAccounts()
    const { commitImport, cancelImport } = useHDImportSession()
    const markBackupComplete = useMarkMnemonicBackupComplete()
    const navigation = useAppNavigation()
    const reactNavigation = useNavigation()

    const { exitAccountFlow } = useExitAccountFlow()
    const { scanRekeyed } = useRekeyScanNotice()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { setAccounts } = useSetAccounts()
    const { seedIdOf } = useKMS()

    const alreadyImportedAddresses = useMemo(() => {
        return new Set(allAccounts.map(acc => acc.address))
    }, [allAccounts])

    const newAccounts = useMemo(() => {
        return accounts.filter(
            acc => !alreadyImportedAddresses.has(acc.address),
        )
    }, [accounts, alreadyImportedAddresses])

    const selectableAddresses = useMemo(
        () => newAccounts.map(acc => acc.address),
        [newAccounts],
    )

    const {
        selectedAddresses,
        isAllSelected,
        toggle: toggleSelection,
        toggleSelectAll,
    } = useAddressSelection(selectableAddresses, {
        initial: newAccounts.length > 0 ? [newAccounts[0].address] : [],
        disabledAddresses: alreadyImportedAddresses,
    })
    const [isProcessing, setIsProcessing] = useState(false)
    const hasCommittedRef = useRef(false)

    const handleContinue = useCallback(async () => {
        setIsProcessing(true)

        void deferToNextCycle(async () => {
            const accountsToAdd = accounts.filter(acc =>
                selectedAddresses.has(acc.address),
            )

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
                    // wallet's bip39 seed as backed up regardless of whether
                    // any new addresses were actually added — re-imports
                    // (every discovered address already in the store) and
                    // accounts created before this feature shipped both rely
                    // on this path to clear the backup banner. Match on the
                    // child→seed parent since `account.keyPairId` is now
                    // the child's id.
                    const accountToMark =
                        accountsToAdd[0] ??
                        allAccounts.find(
                            a => seedIdOf(a.keyPairId) === importWalletKeyId,
                        )
                    if (accountToMark) markBackupComplete(accountToMark)
                } else if (accountsToAdd.length > 0) {
                    // Read the store fresh: this is a replace-array write,
                    // and a concurrent store write since render must not be
                    // dropped with the stale snapshot.
                    const currentAccounts = useAccountsStore.getState().accounts
                    setAccounts([...currentAccounts, ...accountsToAdd])
                    setSelectedAccountAddress(accountsToAdd[0].address)
                }

                // The bip39 seed id scopes the same-seed sibling scan set
                // below. The discovered candidate accounts in `accounts`
                // carry derived child ids on `keyPairId`; resolve the parent
                // to match.
                const walletKeyId =
                    importWalletKeyId ?? seedIdOf(accounts[0].keyPairId)
                if (!walletKeyId) {
                    exitAccountFlow()
                    return
                }
                // Only scan addresses the wallet actually holds after this
                // step: the freshly imported selection plus HD siblings
                // already in the store. Scanning unselected discovered
                // addresses would let the user persist watch accounts
                // rekeyed to an auth address we don't hold.
                const scanAddresses = [
                    ...new Set([
                        ...accountsToAdd.map(a => a.address),
                        ...allAccounts
                            .filter(isHDWalletAccount)
                            .filter(a => seedIdOf(a.keyPairId) === walletKeyId)
                            .map(a => a.address),
                    ]),
                ]
                const discoveredRekeyedAccounts =
                    await scanRekeyed(scanAddresses)

                if (
                    discoveredRekeyedAccounts === REKEY_SCAN_UNAVAILABLE ||
                    discoveredRekeyedAccounts.length === 0
                ) {
                    // A single freshly-imported account gets a naming step so
                    // the user can confirm a custom name; NameAccount renames
                    // the committed account and exits the flow on confirm.
                    // Multi-address imports keep their auto-generated names.
                    if (isImportMode && accountsToAdd.length === 1) {
                        navigation.replace('NameAccount', {
                            account: accountsToAdd[0],
                        })
                    } else {
                        exitAccountFlow()
                    }
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
                // guardrails-ignore-next-line no-error-toast-in-catch reason: localized import_account.failed_body preserved; raw error not surfaced to user
                showToast({
                    type: 'error',
                    title: t('onboarding.import_account.failed_title'),
                    body: t('onboarding.import_account.failed_body'),
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
        scanRekeyed,
        exitAccountFlow,
        navigation,
        setSelectedAccountAddress,
        setAccounts,
        seedIdOf,
        showToast,
        t,
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
        handleContinue: () => void handleContinue(),
        t,
    }
}
