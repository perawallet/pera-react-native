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

import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import type {
    AssetOptInIntent,
    BuildContext,
    PeraTransaction,
    TransactionIntent,
    TransactionSummary,
    TransferIntent,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { encodeToBase64, toBigInt } from '@perawallet/wallet-core-shared'
import { getMinimumFeeConfig } from '../blockchain'
import { isAlgorandNativeAssetId } from '../descriptor'
import { assignFeeToGroup } from '../signing/assignMinimumFeesToGroup'
import { buildOptInTxs, buildTransferTxs } from './builders'
import {
    assertBuildableIntent,
    fetchSuggestedMinFee,
    resolveAlgorandSenderFee,
} from './transfer-fees'

const SEND_TITLE_KEY = 'transactions.list_item.send'
const OPT_IN_TITLE_KEY = 'transactions.list_item.opt_in'

/** Every i18n key a built transaction's summary can carry. */
export const ALGORAND_TRANSFER_TITLE_KEYS = [
    SEND_TITLE_KEY,
    OPT_IN_TITLE_KEY,
] as const

const transferSummary = (intent: TransferIntent): TransactionSummary => {
    const isSelf = intent.from === intent.to
    return {
        kind: isAlgorandNativeAssetId(intent.assetRef.assetId)
            ? 'transfer'
            : 'token-transfer',
        title: { key: SEND_TITLE_KEY },
        direction: isSelf ? 'self' : 'out',
        icon: isSelf ? 'self' : 'send',
        counterparty: intent.to,
        amount: { assetRef: intent.assetRef, value: intent.amount },
    }
}

const OPT_IN_SUMMARY: TransactionSummary = {
    kind: 'chain-specific',
    title: { key: OPT_IN_TITLE_KEY },
    direction: 'none',
    icon: 'opt-in',
}

// The fee rule matches the send flow's: an explicit fee only when the
// sender's PQ-aware minimum exceeds what the node suggests.
const buildTransfer = async (
    intent: TransferIntent,
    { scope }: BuildContext,
): Promise<PeraTransaction[]> => {
    const suggestedMinFee = await fetchSuggestedMinFee(scope)
    const fee = resolveAlgorandSenderFee(intent.from, suggestedMinFee)
    return buildTransferTxs({
        scope,
        sender: intent.from,
        receiver: intent.to,
        assetId: intent.assetRef.assetId,
        amount: toBigInt(intent.amount),
        note: intent.note,
        fee: fee > suggestedMinFee ? fee : undefined,
    })
}

// Built at the base fee, then raised and regrouped: raising a fee after
// grouping without regrouping would leave every member's grp stale.
const buildAssetOptIn = async (
    intent: AssetOptInIntent,
    { scope }: BuildContext,
): Promise<PeraTransaction[]> => {
    const { minTxnFee, pqMultiplier } = getMinimumFeeConfig()
    const drafts = await buildOptInTxs({
        scope,
        sender: intent.account,
        assetId: BigInt(intent.assetRef.assetId),
    })
    const { transactions } = await assignFeeToGroup(
        { transactions: drafts },
        {
            accounts: useAccountsStore.getState().accounts,
            fetchSuggestedMinFee: () =>
                fetchSuggestedMinFee(scope).catch(() => 0n),
            configMinTxnFee: minTxnFee,
            pqMultiplier,
        },
    )
    return transactions
}

export const buildAlgorandTransfer = async (
    intent: TransactionIntent,
    context: BuildContext,
): Promise<UnsignedTransaction[]> => {
    assertBuildableIntent(intent, context)
    const [transactions, summary] =
        intent.kind === 'transfer'
            ? [await buildTransfer(intent, context), transferSummary(intent)]
            : [await buildAssetOptIn(intent, context), OPT_IN_SUMMARY]

    return transactions.map(transaction => ({
        scope: context.scope,
        payload: transaction,
        summary,
        chainData: {
            family: 'algorand',
            groupId: transaction.group
                ? encodeToBase64(transaction.group)
                : undefined,
        },
    }))
}
