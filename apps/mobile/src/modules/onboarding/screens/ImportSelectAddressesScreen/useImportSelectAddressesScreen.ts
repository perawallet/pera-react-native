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
    getAllAccounts,
    useAllAccounts,
    useSetAccounts,
    useSelectedAccountId,
    useHDImportSession,
    chainAccountOf,
    hdIndexOf,
    importableCandidate,
    signingKeyOn,
    useSyncCandidateAccounts,
    type LocalAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    LEGACY_CHAIN_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { useKMS } from '@perawallet/wallet-core-kms'
import { deferToNextCycle, logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useAddressSelection } from '@hooks/useAddressSelection'
import { useToast } from '@hooks/useToast'
import {
    useExitAccountFlow,
    useDelegationScanNoticeResult,
    REKEY_SCAN_UNAVAILABLE,
} from '@modules/onboarding/hooks'
import type { OnboardingStackParamList } from '../../routes/types'

type ImportSelectAddressesRouteProp = RouteProp<
    OnboardingStackParamList,
    'ImportSelectAddresses'
>

export type UseImportSelectAddressesScreenResult = {
    accounts: LocalAccount[]
    selectedAccountIds: Set<string>
    isAllSelected: boolean
    areAllImported: boolean
    canContinue: boolean
    isProcessing: boolean
    importedAccountIds: Set<string>
    /** Some account holds more than one distinct address, so rows and copy speak of accounts rather than addresses. */
    hasLinkedAddresses: boolean
    toggleSelection: (accountId: string) => void
    toggleSelectAll: () => void
    handleContinue: () => void
    t: (key: string, options?: Record<string, unknown>) => string
}

const addressOn = (account: WalletAccount, chainId: ChainId): string =>
    chainAccountOf(account, chainId)?.address ?? ''

export function useImportSelectAddressesScreen(): UseImportSelectAddressesScreenResult {
    const { params } = useRoute<ImportSelectAddressesRouteProp>()
    const { accounts } = params
    const isImportMode = 'mode' in params && params.mode === 'import'
    const importWalletKeyId = isImportMode ? params.walletKeyId : null

    const { t } = useLanguage()
    const { errorToast } = useToast()
    const allAccounts = useAllAccounts()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const addressOf = useCallback(
        (account: WalletAccount) => addressOn(account, scope.chainId),
        [scope.chainId],
    )
    const { commitImport, cancelImport } = useHDImportSession(scope)
    const markBackupComplete = useMarkMnemonicBackupComplete(scope.chainId)
    const navigation = useAppNavigation()
    const reactNavigation = useNavigation()

    const { exitAccountFlow, exitFailedAccountFlow } = useExitAccountFlow()
    const { scanRekeyed } = useDelegationScanNoticeResult()
    const { setSelectedAccountId } = useSelectedAccountId()
    const { setAccounts } = useSetAccounts()
    const { seedIdOf } = useKMS()

    // An account already held is shown whole and disabled; any other shows
    // and imports only the addresses no other account holds.
    const importable = useMemo(
        () =>
            new Map(
                accounts.map(acc => [
                    acc.id,
                    importableCandidate(allAccounts, acc),
                ]),
            ),
        [accounts, allAccounts],
    )

    const candidates = useMemo(
        () => accounts.map(acc => importable.get(acc.id) ?? acc),
        [accounts, importable],
    )

    const importedAccountIds = useMemo(
        () =>
            new Set(
                accounts.flatMap(acc =>
                    importable.get(acc.id) ? [] : [acc.id],
                ),
            ),
        [accounts, importable],
    )

    const newAccounts = useMemo(
        () => candidates.filter(acc => !importedAccountIds.has(acc.id)),
        [candidates, importedAccountIds],
    )

    const selectableAccountIds = useMemo(
        () => newAccounts.map(acc => acc.id),
        [newAccounts],
    )

    const hasLinkedAddresses = useMemo(
        () =>
            candidates.some(
                acc =>
                    new Set(
                        Object.values(acc.chains).flatMap(entry =>
                            entry ? [entry.address] : [],
                        ),
                    ).size > 1,
            ),
        [candidates],
    )

    useSyncCandidateAccounts(candidates)

    const {
        selectedAddresses: selectedAccountIds,
        isAllSelected,
        toggle: toggleSelection,
        toggleSelectAll,
    } = useAddressSelection(selectableAccountIds, {
        initial: newAccounts.length > 0 ? [newAccounts[0].id] : [],
        disabledAddresses: importedAccountIds,
    })
    const [isProcessing, setIsProcessing] = useState(false)
    const hasCommittedRef = useRef(false)

    const handleContinue = useCallback(async () => {
        setIsProcessing(true)

        void deferToNextCycle(async () => {
            const accountsToAdd = newAccounts.filter(acc =>
                selectedAccountIds.has(acc.id),
            )

            try {
                if (isImportMode && importWalletKeyId) {
                    if (accountsToAdd.length > 0) {
                        await commitImport({
                            walletKeyId: importWalletKeyId,
                            selectedAccounts: accountsToAdd,
                        })
                        hasCommittedRef.current = true
                        setSelectedAccountId(accountsToAdd[0].id)
                    } else {
                        // Re-import path: every selected account was already in
                        // the store, so there's nothing to commit. The session
                        // still proved possession, so it is cancelled here and
                        // not by the beforeRemove listener.
                        cancelImport()
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
                            a =>
                                seedIdOf(signingKeyOn(a, scope.chainId)) ===
                                importWalletKeyId,
                        )
                    if (accountToMark) markBackupComplete(accountToMark)
                } else if (accountsToAdd.length > 0) {
                    // Read the store fresh: this is a replace-array write,
                    // and a concurrent store write since render must not be
                    // dropped with the stale snapshot.
                    const currentAccounts = getAllAccounts()
                    setAccounts([...currentAccounts, ...accountsToAdd])
                    hasCommittedRef.current = true
                    setSelectedAccountId(accountsToAdd[0].id)
                }

                // The bip39 seed id scopes the same-seed sibling scan set
                // below. The discovered candidate accounts in `accounts`
                // carry derived child ids on `keyPairId`; resolve the parent
                // to match.
                const walletKeyId =
                    importWalletKeyId ??
                    seedIdOf(signingKeyOn(accounts[0], scope.chainId))
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
                    ...new Set(
                        [
                            ...accountsToAdd.map(addressOf),
                            ...allAccounts
                                .filter(a => hdIndexOf(a) !== undefined)
                                .filter(
                                    a =>
                                        seedIdOf(
                                            signingKeyOn(a, scope.chainId),
                                        ) === walletKeyId,
                                )
                                .map(addressOf),
                        ].filter(address => address !== ''),
                    ),
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
                // Anything after the accounts are persisted (naming, backup
                // flag, navigation) failing must not be reported as a failed
                // import: the user holds the account, and their retry would
                // then say "already added".
                if (!hasCommittedRef.current) {
                    // Not showError: an unrecognised error would fall through to generic copy instead of this step's.
                    errorToast(
                        t('onboarding.import_account.failed_title'),
                        t('onboarding.import_account.failed_body'),
                    )
                    exitFailedAccountFlow()
                    return
                }
                exitAccountFlow()
            } finally {
                setIsProcessing(false)
            }
        })
    }, [
        accounts,
        newAccounts,
        selectedAccountIds,
        allAccounts,
        isImportMode,
        importWalletKeyId,
        commitImport,
        cancelImport,
        markBackupComplete,
        scanRekeyed,
        exitAccountFlow,
        exitFailedAccountFlow,
        navigation,
        setSelectedAccountId,
        setAccounts,
        seedIdOf,
        errorToast,
        t,
        scope.chainId,
        addressOf,
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
    const canContinue = areAllImported || selectedAccountIds.size > 0

    return {
        accounts: candidates,
        selectedAccountIds,
        isAllSelected,
        areAllImported,
        canContinue,
        isProcessing,
        importedAccountIds,
        hasLinkedAddresses,
        toggleSelection,
        toggleSelectAll,
        handleContinue: () => void handleContinue(),
        t,
    }
}
