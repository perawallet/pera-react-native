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
import {
    chainAccountOf,
    isAutoHiddenHolding,
    useKeptTokensStore,
    useSelectedAccount,
    type KeptTokens,
} from '@perawallet/wallet-core-accounts'
import {
    useStoredAssetsAcrossScopesQuery,
    type PeraAsset,
    type ScopedAssetIds,
} from '@perawallet/wallet-core-assets'
import {
    toScopeKey,
    type ChainScope,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    recordSignerOf,
    summarizeHistoryItem,
    type SuspectedPoisoning,
} from '@perawallet/wallet-core-transactions'
import type { Optional } from '@perawallet/wallet-core-shared'
import { assessHistoryEntry } from '../../utils/historySuspicion'
import { summaryAmountsOf } from '../../utils/summaryAmounts'
import {
    TRANSACTION_ROW_TYPES,
    type TransactionListRow,
} from '../../utils/transactionListRows'

export type UseWithoutSuspiciousRowsParams = {
    rows: TransactionListRow[]
    suspectedPoisoningById: ReadonlyMap<string, SuspectedPoisoning>
    /** Off returns `rows` as given and reads nothing. */
    isEnabled: boolean
}

type Entry = {
    key: string
    scope: ChainScope
    summary: TransactionSummary
    signer: Optional<string>
    isSignedElsewhere: Optional<boolean>
    accountAddress: string
}

/**
 * Someone else's transaction that moved a token waiting in the inbox: an
 * airdrop or a spoofed transfer. The account's own stays, whatever it moved,
 * and so does one whose signer the history doesn't name. A token with no
 * stored row is left in too, since nothing says it's unwanted.
 */
const movesUnapprovedToken = (
    entry: Entry,
    storedAssets: Optional<ReadonlyMap<string, PeraAsset>>,
    keptTokens: KeptTokens,
): boolean =>
    !!entry.signer &&
    entry.signer.toLowerCase() !== entry.accountAddress.toLowerCase() &&
    summaryAmountsOf(entry.summary).some(({ assetRef: { assetId } }) => {
        const asset = storedAssets?.get(assetId)
        return (
            !!asset &&
            isAutoHiddenHolding(
                {
                    address: entry.accountAddress,
                    scope: entry.scope,
                    assetId,
                    asset,
                },
                keptTokens,
            )
        )
    })

/**
 * The rows without the entries a history row would badge as suspicious or
 * that move a token waiting in the inbox, and without a date header left over
 * them. Judged by the same test as the row, on the stored assets of every
 * network the list mixes.
 */
export const useWithoutSuspiciousRows = ({
    rows,
    suspectedPoisoningById,
    isEnabled,
}: UseWithoutSuspiciousRowsParams): TransactionListRow[] => {
    const account = useSelectedAccount()

    const entries = useMemo<Entry[]>(() => {
        if (!isEnabled) return []
        return rows.flatMap((row): Entry[] => {
            if (row.kind === TRANSACTION_ROW_TYPES.header) return []
            const scope =
                row.kind === TRANSACTION_ROW_TYPES.record
                    ? row.record.scope
                    : row.scope
            const accountAddress = account
                ? (chainAccountOf(account, scope.chainId)?.address ?? '')
                : ''
            if (row.kind === TRANSACTION_ROW_TYPES.record) {
                return [
                    {
                        key: row.key,
                        scope,
                        summary: row.record.summary,
                        signer: recordSignerOf(row.record, accountAddress),
                        isSignedElsewhere: row.record.isSignedElsewhere,
                        accountAddress,
                    },
                ]
            }
            return [
                {
                    key: row.key,
                    scope,
                    summary: summarizeHistoryItem(
                        row.transaction,
                        accountAddress,
                        scope.chainId,
                    ),
                    signer: row.transaction.sender,
                    isSignedElsewhere: undefined,
                    accountAddress,
                },
            ]
        })
    }, [isEnabled, rows, account])

    const assetGroups = useMemo<ScopedAssetIds[]>(() => {
        const byScope = new Map<string, ScopedAssetIds>()
        for (const entry of entries) {
            const key = toScopeKey(entry.scope)
            const group = byScope.get(key) ?? {
                scope: entry.scope,
                assetIds: [],
            }
            for (const amount of summaryAmountsOf(entry.summary)) {
                group.assetIds.push(amount.assetRef.assetId)
            }
            byScope.set(key, group)
        }
        return [...byScope.values()]
    }, [entries])
    const storedByScope = useStoredAssetsAcrossScopesQuery(assetGroups)
    const keptTokens = useKeptTokensStore(state => state.keptTokens)

    return useMemo(() => {
        if (!isEnabled) return rows
        const hidden = new Set(
            entries
                .filter(
                    entry =>
                        movesUnapprovedToken(
                            entry,
                            storedByScope.get(toScopeKey(entry.scope)),
                            keptTokens,
                        ) ||
                        assessHistoryEntry({
                            summary: entry.summary,
                            signer: entry.signer,
                            isSignedElsewhere: entry.isSignedElsewhere,
                            accountAddress: entry.accountAddress,
                            chainId: entry.scope.chainId,
                            isSuspectedPoisoning: suspectedPoisoningById.has(
                                entry.key,
                            ),
                            storedAssets: storedByScope.get(
                                toScopeKey(entry.scope),
                            ),
                        }).suspicion !== null,
                )
                .map(entry => entry.key),
        )
        const kept = rows.filter(row => !hidden.has(row.key))
        // A header stays only with an entry under it before the next header.
        return kept.filter(
            (row, index) =>
                row.kind !== TRANSACTION_ROW_TYPES.header ||
                (kept[index + 1] !== undefined &&
                    kept[index + 1]!.kind !== TRANSACTION_ROW_TYPES.header),
        )
    }, [
        isEnabled,
        rows,
        entries,
        storedByScope,
        suspectedPoisoningById,
        keptTokens,
    ])
}
