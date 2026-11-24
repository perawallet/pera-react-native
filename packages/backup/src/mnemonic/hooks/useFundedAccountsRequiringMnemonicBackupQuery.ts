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

import { useMemo } from 'react'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAnyEnabledChainHasCapability } from '@perawallet/wallet-core-chain-shared'
import {
    useAuthorityAccountIds,
    useFundedAccountIdsQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useRequiresMnemonicBackupCheck } from './useRequiresMnemonicBackupCheck'

const NO_ACCOUNTS: WalletAccount[] = []

export type UseFundedAccountsRequiringMnemonicBackupQueryResult = {
    /** Funded accounts whose recovery passphrase is in Pera with no manual backup, in input order. */
    accounts: WalletAccount[]
    isPending: boolean
}

// Same rule as the backup warning (`useShouldPromptMnemonicBackup`) without
// its Cloud Backup term: it asks which accounts have only Pera's copy of their
// secret, for the moment that copy is about to go. A failed balance lookup
// lists the account, since a missed warning here can't be taken back.
export const useFundedAccountsRequiringMnemonicBackupQuery = (
    accounts: WalletAccount[],
    scope: ChainScope,
): UseFundedAccountsRequiringMnemonicBackupQueryResult => {
    const canBackUpMnemonic = useAnyEnabledChainHasCapability('mnemonicBackup')
    const requiresBackup = useRequiresMnemonicBackupCheck()

    const candidates = useMemo(
        () =>
            canBackUpMnemonic ? accounts.filter(requiresBackup) : NO_ACCOUNTS,
        [canBackUpMnemonic, accounts, requiresBackup],
    )
    const { fundedAccountIds, failedAccountIds, isPending } =
        useFundedAccountIdsQuery(candidates, scope)
    const authorityAccountIds = useAuthorityAccountIds(
        candidates,
        scope.chainId,
    )

    return useMemo(() => {
        const atRisk = new Set([
            ...fundedAccountIds,
            ...failedAccountIds,
            ...authorityAccountIds,
        ])
        return {
            accounts: candidates.filter(({ id }) => atRisk.has(id)),
            isPending,
        }
    }, [
        candidates,
        fundedAccountIds,
        failedAccountIds,
        authorityAccountIds,
        isPending,
    ])
}
