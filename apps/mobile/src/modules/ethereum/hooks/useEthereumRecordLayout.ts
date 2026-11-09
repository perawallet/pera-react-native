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
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetsQuery, useNativeAsset } from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    type BalanceChange,
    type I18nKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { isFeePaidByAccount } from '@perawallet/wallet-core-transactions'
import { transactionIconName } from '@components/TransactionIcon'
import { useLanguage } from '@hooks/useLanguage'
import {
    useTransactionHeroTitle,
    type TransactionDetailAmount,
    type TransactionDetailStatus,
    type TransactionDetailSummary,
} from '@modules/signing'
import { useResolvedSummaryTitle } from '@modules/transactions'
import { isEvmTransactionHash } from '../utils/isEvmTransactionHash'
import { recordAmountsOf } from '../utils/recordAmountsOf'
import { recordPartiesOf } from '../utils/recordPartiesOf'
import {
    GENERIC_CALL_TITLE_KEYS,
    REVOKE_APPROVAL_TITLE_KEY,
} from '../utils/recordTitleKeys'
import type { EthereumTransactionPresentation } from './useEthereumTransactionPresentation'

export type UseEthereumRecordLayoutResult = {
    summary: TransactionDetailSummary
    /** The balance legs the hero doesn't carry. */
    amountRows: BalanceChange[]
    /** What the history names the asset moved, such as an NFT's collection and token id; the call's own read says it itself. */
    assetLabel?: string
}

const STATUS: Record<TransactionRecord['status'], TransactionDetailStatus> = {
    confirmed: 'completed',
    pending: 'pending',
    failed: 'failed',
    replaced: 'failed',
}

// A call's own amount (an approval's allowance, a contract call's value) is
// one leg among its effects, so only a plain transfer leads with it.
const LEADING_KINDS: readonly TransactionRecord['summary']['kind'][] = [
    'transfer',
    'token-transfer',
]

// The kinds that move value to a single recipient; an approval or call names a
// spender or contract, which the signed view shows in the call's own details.
const RECIPIENT_KINDS: readonly TransactionRecord['summary']['kind'][] = [
    ...LEADING_KINDS,
    'nft-transfer',
]

// The row's title stands unless the node read knows more: a revocation, or
// a call the history could only name generically.
const isReadTitleBetter = (rowKey: I18nKey, readKey: I18nKey): boolean =>
    readKey === REVOKE_APPROVAL_TITLE_KEY ||
    (GENERIC_CALL_TITLE_KEYS.has(rowKey) &&
        !GENERIC_CALL_TITLE_KEYS.has(readKey))

export const useEthereumRecordLayout = (
    record: TransactionRecord,
    presentation?: Nullable<EthereumTransactionPresentation>,
): UseEthereumRecordLayoutResult => {
    const { t } = useLanguage()
    const heroTitle = useTransactionHeroTitle()
    const { scope, summary: recordSummary } = record
    const summaryTitle = useResolvedSummaryTitle(recordSummary, scope)
    const nativeAsset = useNativeAsset(scope)
    const account = useSelectedAccount()
    const ownAddress = account
        ? (chainAccountOf(account, scope.chainId)?.address ?? '')
        : ''

    const leading =
        LEADING_KINDS.includes(recordSummary.kind) &&
        !recordSummary.balanceChanges
            ? recordSummary.amount
            : undefined
    // From the local store only, as the list row does: a page that makes no
    // node read of its own must not trigger one by naming a token.
    const { data: storedAssets, isPending: isAssetsPending } = useAssetsQuery(
        scope,
        leading ? [leading.assetRef.assetId] : [],
    )

    return useMemo(() => {
        const parties = recordPartiesOf(record, ownAddress)

        let amount: Optional<TransactionDetailAmount>
        if (leading) {
            const { assetId } = leading.assetRef
            const known =
                assetId === nativeAsset.assetId
                    ? nativeAsset
                    : (storedAssets.get(assetId) ??
                      (leading.display && {
                          assetId,
                          unitName: leading.display.symbol,
                          decimals: leading.display.decimals,
                      }))
            if (known) {
                amount = {
                    asset: known,
                    value: baseUnitsToDisplayUnits(
                        leading.value.abs(),
                        known.decimals ?? 0,
                    ),
                }
            }
        }

        // Pending only while the store has not answered; a miss is settled and falls back to the raw leg.
        const isAmountLoading = !!leading && !amount && isAssetsPending

        return {
            summary: {
                scope,
                iconName:
                    presentation?.iconName ??
                    transactionIconName(recordSummary.icon),
                title: heroTitle(
                    presentation &&
                        isReadTitleBetter(
                            recordSummary.title.key,
                            presentation.titleKey,
                        )
                        ? { key: presentation.titleKey }
                        : summaryTitle,
                ),
                status: STATUS[record.status],
                amount,
                isAmountLoading,
                transactionId: isEvmTransactionHash(record.id)
                    ? record.id
                    : undefined,
                timestamp: record.timestamp,
                block:
                    record.blockNumber === undefined
                        ? undefined
                        : {
                              labelKey: i18nKey('transactions.common.block'),
                              number: record.blockNumber.toString(),
                          },
                from: parties.from,
                to: RECIPIENT_KINDS.includes(recordSummary.kind)
                    ? parties.to
                    : undefined,
                fee:
                    record.fee && isFeePaidByAccount(record, ownAddress)
                        ? {
                              asset: nativeAsset,
                              value: baseUnitsToDisplayUnits(
                                  record.fee,
                                  nativeAsset.decimals,
                              ),
                          }
                        : undefined,
            },
            // Keyed off what the hero resolved, so a leg it couldn't name still shows.
            amountRows:
                amount || isAmountLoading ? [] : recordAmountsOf(recordSummary),
            assetLabel:
                recordSummary.kind === 'nft-transfer' && recordSummary.subtitle
                    ? t(
                          recordSummary.subtitle.key,
                          recordSummary.subtitle.params,
                      )
                    : undefined,
        }
    }, [
        record,
        recordSummary,
        scope,
        ownAddress,
        leading,
        nativeAsset,
        storedAssets,
        isAssetsPending,
        presentation,
        summaryTitle,
        heroTitle,
        t,
    ])
}
