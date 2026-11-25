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

import { canHideHolding } from '@perawallet/wallet-core-accounts'
import {
    isSpamAssetText,
    PeraAssetVerificationTier,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    isEvmChainId,
    type ChainId,
    type I18nKey,
    type LocalizedText,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { imitatedTickerOf } from '@perawallet/wallet-core-currencies'
import { isSentByOtherSigner } from '@perawallet/wallet-core-transactions'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    MAX_VISIBLE_AMOUNTS,
    summaryAmountsOf,
    type SummaryAmount,
} from './summaryAmounts'

export type HistorySuspicion =
    | { kind: 'poisoning' }
    | { kind: 'imitated'; code: string }
    | { kind: 'spoofed' }
    | { kind: 'flagged-token' }

export type HistoryEntryAssessment = {
    /** Why the entry is suspect, most specific first; null for an ordinary one. */
    suspicion: Nullable<HistorySuspicion>
    /** Replaces the summary's own title: a spoofed send, or a real allowance spend. */
    titleKey: Optional<I18nKey>
    /** Another address spent an allowance the account granted. */
    isApprovedSend: boolean
    /** No real value moved (poisoning, a spoofed send), so its amounts read grey and unsigned. */
    isMovingNothing: boolean
    /** The visible amounts whose token is flagged, by asset id. */
    flaggedAssetIds: ReadonlySet<string>
}

export type AssessHistoryEntryParams = {
    summary: TransactionSummary
    /** Who signed it, when the history says. */
    signer: Optional<string>
    isSignedElsewhere: Optional<boolean>
    accountAddress: string
    chainId: ChainId
    isSuspectedPoisoning: boolean
    /** The local store's rows for the entry's assets; a miss falls back to the history's own symbol. */
    storedAssets: Optional<ReadonlyMap<string, PeraAsset>>
}

const SEND_BY_APPROVAL = i18nKey('transactions.list_item.send_by_approval')
const SPOOFED_SEND = i18nKey('transactions.list_item.spoofed_send')

const unitNameOf = (
    amount: SummaryAmount,
    stored: Optional<PeraAsset>,
): Optional<string> => stored?.unitName ?? amount.display?.symbol

/**
 * A token Pera flags, or one whose name advertises a scam (a link, a lure
 * emoji, a call to claim), on a chain that receives tokens unasked: on an
 * opt-in chain the user chose the asset.
 */
const isFlaggedToken = (
    amount: SummaryAmount,
    stored: Optional<PeraAsset>,
): boolean =>
    canHideHolding(amount.assetRef.chainId, amount.assetRef.assetId) &&
    (stored?.peraMetadata?.verificationTier ===
        PeraAssetVerificationTier.suspicious ||
        [unitNameOf(amount, stored), stored?.name].some(
            text => !!text && isSpamAssetText(text),
        ))

/**
 * The one reading of a history entry its row, its detail title and the
 * hide-suspicious filter all share, so they can't disagree.
 *
 * Only on EVM can another signer's send be spoofed or an allowance spend: on
 * Algorand it is a clawback, and 0-ALGO transactions are routine. ERC-20 lets
 * anyone move 0 of a real token "from" any account, and a scam token's
 * contract can log a transfer from any account it likes, so a send someone
 * else signed that moved nothing, or moved a look-alike token, is a log line.
 */
export const assessHistoryEntry = ({
    summary,
    signer,
    isSignedElsewhere,
    accountAddress,
    chainId,
    isSuspectedPoisoning,
    storedAssets,
}: AssessHistoryEntryParams): HistoryEntryAssessment => {
    const amounts = summaryAmountsOf(summary)
    const visible = amounts.slice(0, MAX_VISIBLE_AMOUNTS)
    const storedOf = (amount: SummaryAmount) =>
        storedAssets?.get(amount.assetRef.assetId)
    const imitatedOf = (amount: SummaryAmount) =>
        imitatedTickerOf(amount.assetRef, unitNameOf(amount, storedOf(amount)))

    const isSignedByOther =
        isEvmChainId(chainId) &&
        isSentByOtherSigner({
            summary,
            signer,
            isSignedElsewhere,
            accountAddress,
            chainId,
        })
    const isSpoofedSend =
        isSignedByOther &&
        !isSuspectedPoisoning &&
        (amounts.every(amount => amount.baseUnits.isZero()) ||
            amounts.some(amount => imitatedOf(amount) !== null))
    const flaggedAssetIds = new Set(
        visible
            .filter(amount => isFlaggedToken(amount, storedOf(amount)))
            .map(amount => amount.assetRef.assetId),
    )

    const suspicionOf = (): Nullable<HistorySuspicion> => {
        if (isSuspectedPoisoning) return { kind: 'poisoning' }
        for (const amount of visible) {
            const code = imitatedOf(amount)
            if (code !== null) return { kind: 'imitated', code }
        }
        if (isSpoofedSend) return { kind: 'spoofed' }
        return flaggedAssetIds.size > 0 ? { kind: 'flagged-token' } : null
    }
    const suspicion = suspicionOf()
    const isApprovedSend = isSignedByOther && suspicion === null

    const titleKeyOf = (): Optional<I18nKey> => {
        if (isApprovedSend) return SEND_BY_APPROVAL
        return isSpoofedSend ? SPOOFED_SEND : undefined
    }

    return {
        suspicion,
        titleKey: titleKeyOf(),
        isApprovedSend,
        isMovingNothing: isSuspectedPoisoning || isSpoofedSend,
        flaggedAssetIds,
    }
}

/** The title and body of the sheet that explains a suspicion. */
export const suspicionCopyOf = (
    suspicion: HistorySuspicion,
): { title: LocalizedText; body: LocalizedText } => {
    switch (suspicion.kind) {
        case 'poisoning': {
            return {
                title: {
                    key: i18nKey('transactions.suspected_poisoning.title'),
                },
                body: { key: i18nKey('transactions.suspected_poisoning.body') },
            }
        }
        case 'imitated': {
            const params = { code: suspicion.code }
            return {
                title: {
                    key: i18nKey('asset.imitated_currency.title'),
                    params,
                },
                body: { key: i18nKey('asset.imitated_currency.body'), params },
            }
        }
        case 'spoofed': {
            return {
                title: {
                    key: i18nKey('transactions.suspected_fake_transfer.title'),
                },
                body: {
                    key: i18nKey('transactions.suspected_fake_transfer.body'),
                },
            }
        }
        case 'flagged-token': {
            return {
                title: {
                    key: i18nKey(
                        'asset_details.token_warning.suspicious_title',
                    ),
                },
                body: { key: i18nKey('asset_details.token_warning.body') },
            }
        }
        default: {
            const exhaustive: never = suspicion
            return exhaustive
        }
    }
}
