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
import { useQueries } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import {
    accountChainEntries,
    accountFundedNetworksQueryOptions,
    chainAccountOf,
    useOtherRegisteredChainIds,
    useDelegationAuthorities,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useMnemonicBackupStore } from '../store'
import { requiresMnemonicBackup } from './useRequiresMnemonicBackup'
import { isMnemonicBackupPromptDue } from './useShouldPromptMnemonicBackup'

export type UseAccountsNeedingMnemonicBackupResult = {
    /** In the order of `accounts`. */
    accounts: WalletAccount[]
    /** True until every account's funding is known. */
    isPending: boolean
}

/** `useShouldPromptMnemonicBackup` over a list, for surfaces that count. */
export const useAccountsNeedingMnemonicBackup = (
    accounts: readonly WalletAccount[],
    scope: ChainScope,
): UseAccountsNeedingMnemonicBackupResult => {
    const backedUpKeyIds = useMnemonicBackupStore(state => state.backedUpKeyIds)
    const canBackUpMnemonic = useChainCapability(
        scope.chainId,
        'mnemonicBackup',
    )
    const addresses = useMemo(
        () =>
            accounts.map(
                account =>
                    chainAccountOf(account, scope.chainId)?.address ?? '',
            ),
        [accounts, scope.chainId],
    )
    const authorities = useDelegationAuthorities(addresses, scope.chainId)
    const otherChainIds = useOtherRegisteredChainIds(scope.chainId)
    // Every account's chain addresses in one batch; owners maps each lookup back
    // to its account so funding on any chain counts, as on the single-account hook.
    const { entries, owners } = useMemo(() => {
        const perAccount = accounts.map(account =>
            accountChainEntries(account, scope.chainId, otherChainIds),
        )
        return {
            entries: perAccount.flat(),
            owners: perAccount.flatMap((list, index) => list.map(() => index)),
        }
    }, [accounts, scope.chainId, otherChainIds])
    const funding = useQueries({
        queries: entries.map(entry =>
            accountFundedNetworksQueryOptions(entry, scope),
        ),
    })

    const isPending = funding.some(query => query.isPending)
    const fundedFlags = accounts.map((_, index) =>
        funding.some(
            (query, lookup) =>
                owners[lookup] === index && (query.data?.length ?? 0) > 0,
        ),
    )
    const fundedKey = fundedFlags.join()

    const needing = useMemo(
        () =>
            accounts.filter((account, index) =>
                isMnemonicBackupPromptDue({
                    canBackUpMnemonic,
                    requiresBackup: requiresMnemonicBackup(
                        account,
                        scope.chainId,
                        backedUpKeyIds,
                    ),
                    isFunded: fundedFlags[index] ?? false,
                    isDelegatedTo: authorities.has(addresses[index] ?? ''),
                }),
            ),
        // fundedKey stands in for fundedFlags, a new array every render.
        // oxlint-disable-next-line react-hooks/exhaustive-deps -- see above
        [
            accounts,
            addresses,
            authorities,
            backedUpKeyIds,
            canBackUpMnemonic,
            fundedKey,
            scope.chainId,
        ],
    )

    return { accounts: needing, isPending }
}
