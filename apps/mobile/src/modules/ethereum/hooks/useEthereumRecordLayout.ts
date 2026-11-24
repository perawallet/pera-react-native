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
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { toEvmNftAssetId } from '@perawallet/wallet-core-chain-ethereum'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    isFeePaidByAccount,
    isSentByOtherSigner,
    recordSignerOf,
} from '@perawallet/wallet-core-transactions'
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
    CONTRACT_CALL_TITLE_KEY,
    REVOKE_APPROVAL_TITLE_KEY,
} from '../utils/recordTitleKeys'
import type { EthereumTransactionPresentation } from './useEthereumTransactionPresentation'

export type UseEthereumRecordLayoutResult = {
    summary: TransactionDetailSummary
    /** The balance legs the hero doesn't carry. */
    amountRows: BalanceChange[]
    /** What the history names the asset moved, such as an NFT's collection and token id; the call's own read says it itself. */
    assetLabel?: string
    /** The token contract of a single non-native transfer, so a lookalike symbol can be told from the asset itself. */
    assetContract?: string
}

const STATUS: Record<TransactionRecord['status'], TransactionDetailStatus> = {
    confirmed: 'completed',
    pending: 'pending',
    failed: 'failed',
    replaced: 'failed',
}

const NOT_SENT_BY_YOU = i18nKey('transactions.list_item.not_sent_by_you')

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

// Known from the calldata before the NFT's own record loads, so its leg doesn't flash in meanwhile.
const readNftAssetIdOf = ({
    view,
    standardCall,
}: EthereumTransactionPresentation): Optional<string> => {
    if (view.nft) return view.nft.assetId
    if (standardCall?.kind !== 'nft-transfer') return undefined
    const [only, ...rest] = standardCall.items
    if (!only || rest.length > 0) return undefined
    try {
        return toEvmNftAssetId(standardCall.contract, only.tokenId)
    } catch {
        return undefined
    }
}

// The row's title stands unless the node read knows more: a revocation, an
// NFT grant of token #0 the row took for a revocation, or an action for a call
// the history named none for. Only a found NFT overrides a revoke: a read that
// can't place the token, or hasn't yet, says approval of a real ERC-20 revoke.
const isReadTitleBetter = (
    row: TransactionSummary,
    { titleKey, standardCall }: EthereumTransactionPresentation,
): boolean =>
    titleKey === REVOKE_APPROVAL_TITLE_KEY ||
    (row.title.key === REVOKE_APPROVAL_TITLE_KEY &&
        standardCall?.kind === 'nft-approval' &&
        !standardCall.isRevocation) ||
    (!!row.isActionUnknown && titleKey !== CONTRACT_CALL_TITLE_KEY)

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

        const isNotSentByYou = isSentByOtherSigner({
            summary: recordSummary,
            signer: recordSignerOf(record, ownAddress),
            isSignedElsewhere: record.isSignedElsewhere,
            accountAddress: ownAddress,
            chainId: scope.chainId,
        })

        const title =
            presentation && isReadTitleBetter(recordSummary, presentation)
                ? { key: presentation.titleKey }
                : summaryTitle

        // Pending only while the store has not answered; a miss is settled and falls back to the raw leg.
        const isAmountLoading = !!leading && !amount && isAssetsPending

        // A read NFT transfer already shows the NFT and its amount, so its leg isn't listed again.
        // Only NFTs: a token's leg is the balance actually moved, which a fee-taking token can make differ from the call.
        const readNftAssetId =
            presentation?.isTransfer &&
            (presentation.amount || presentation.isAmountLoading)
                ? readNftAssetIdOf(presentation)
                : undefined
        const isShownByRead = (leg: BalanceChange) =>
            !!readNftAssetId &&
            leg.assetRef.assetId.toLowerCase() === readNftAssetId.toLowerCase()

        return {
            summary: {
                scope,
                iconName:
                    presentation?.iconName ??
                    transactionIconName(recordSummary.icon),
                title: heroTitle(
                    isNotSentByYou ? { key: NOT_SENT_BY_YOU } : title,
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
                from: parties.from ?? presentation?.view.from,
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
                isFeeMaximum: record.isFeeMaximum,
            },
            // Keyed off what the hero resolved, so a leg it couldn't name still shows.
            amountRows:
                amount || isAmountLoading
                    ? []
                    : recordAmountsOf(recordSummary).filter(
                          leg => !isShownByRead(leg),
                      ),
            assetLabel:
                recordSummary.kind === 'nft-transfer' && recordSummary.subtitle
                    ? t(
                          recordSummary.subtitle.key,
                          recordSummary.subtitle.params,
                      )
                    : undefined,
            assetContract:
                recordSummary.kind === 'token-transfer' &&
                leading &&
                leading.assetRef.assetId !== nativeAsset.assetId
                    ? leading.assetRef.assetId
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
