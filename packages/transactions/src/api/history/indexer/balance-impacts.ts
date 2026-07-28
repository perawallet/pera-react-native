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

const ALGO_ASSET_KEY = '0'

type PaymentLeg = {
    amount: number | string | bigint
    receiver: string
    'close-remainder-to'?: string
    'close-amount'?: number | string | bigint
}

type AssetTransferLeg = {
    'asset-id': number | string | bigint
    amount: number | string | bigint
    receiver: string
    /**
     * (asnd) The effective sender during a clawback: the address actually
     * debited. This is nested here as `sender` (confirmed against the
     * indexer's own OpenAPI schema and algosdk's wire-encoding map) — there
     * is no top-level `asset-sender` field in real indexer responses. It is
     * easy to assume otherwise, since the enclosing transaction also has its
     * own unrelated top-level `sender` (the clawback authority executing the
     * revocation, not the account being clawed back from).
     */
    sender?: string
    'close-to'?: string
    'close-amount'?: number | string | bigint
}

/** The recursive subset of an indexer transaction this math reads. */
export type IndexerTransactionLike = {
    'tx-type': string
    sender: string
    fee: number | string | bigint
    'payment-transaction'?: PaymentLeg
    'asset-transfer-transaction'?: AssetTransferLeg
    'inner-txns'?: IndexerTransactionLike[]
}

export type BalanceImpact = {
    assetId: string
    /** Signed, in the asset's base units. Negative = left the account. */
    amount: bigint
}

// The client's JSON parsing (parsePrecisionSafeJson) deliberately surfaces
// uint64 values above 2^53-1 as decimal *strings* rather than rounding them
// — real fnet assets have totals around 1e16, well into that range. `string`
// must stay in this union: narrowing it back to `number | bigint` would
// silently zero out exactly the values precision-safe parsing exists to
// protect (BigInt(undefined) is a TypeError, so the `typeof value ===
// 'number'` shortcut a future edit might reach for would need its own
// `undefined` guard — easy to get wrong twice over). BigInt(value) handles
// all three input forms losslessly.
const toBigInt = (value: number | string | bigint | undefined): bigint =>
    value === undefined ? 0n : BigInt(value)

const add = (deltas: Map<string, bigint>, assetId: string, amount: bigint) => {
    deltas.set(assetId, (deltas.get(assetId) ?? 0n) + amount)
}

const accumulate = (
    transaction: IndexerTransactionLike,
    address: string,
    deltas: Map<string, bigint>,
): void => {
    // Fees are always ALGO and are always paid by the transaction's own
    // sender. Every node in this tree — top-level or inner, at any depth —
    // is charged independently via its OWN `sender` field through the
    // recursion below; this does NOT depend on inner fees being zero.
    // Verified against live mainnet/fnet data: inner transactions frequently
    // report a nonzero fee (an app often pays its own inner-transaction fee
    // from its own account rather than relying on fee pooling from the outer
    // call — observed values up to 20000 microAlgos on mainnet).
    //
    // This reproduces the ledger unconditionally, even if an inner
    // transaction's sender happens to equal an ancestor's sender (possible
    // when an account is rekeyed to the app that fans out) — NOT merely
    // because senders differed in every transaction sampled while verifying
    // this (that would be a defeatable sampling argument). The real
    // invariant is structural: fee pooling is already resolved by the time
    // the indexer reports a transaction, so each node's `fee` field IS that
    // node's own actual deduction. Per-node attribution therefore has
    // nothing left to double-count regardless of who the senders are.
    if (transaction.sender === address) {
        add(deltas, ALGO_ASSET_KEY, -toBigInt(transaction.fee))
    }

    // Real indexer transactions also carry `sender-rewards`,
    // `receiver-rewards` and `close-rewards`. They are deliberately not
    // modeled here and not part of `IndexerTransactionLike`.
    //
    // These are NOT always 0 — betanet's early history (rounds ~357-2.68M)
    // has real nonzero rewards (148/1000 sampled transactions nonzero;
    // sender-rewards up to ~1,588,752,226,856 microAlgo observed at round
    // 602775). Omitting them is safe for a narrower, UI-GATING reason, not a
    // protocol one: `balanceImpacts` has exactly one non-test read site
    // today (apps/mobile's useTransactionAmounts.ts), and it only reads this
    // field when `transaction.txType === 'appl'`. On every network checked
    // (betanet, fnet, near-tip mainnet), participation rewards were already
    // 0 by the time `appl` transactions exist at all — on betanet
    // specifically, the first `appl` appears around round 8.1M, long after
    // the reward-bearing era ended (confirmed 0 nonzero across 1000+
    // transactions sampled at that round). This argument breaks if a future
    // consumer ever reads `balanceImpacts` for a non-`appl` transaction (or
    // for a network/round where rewards were still active) — re-check this
    // reasoning before relying on it in that case.
    const payment = transaction['payment-transaction']
    if (payment) {
        const closeTo = payment['close-remainder-to']
        const closeAmount = toBigInt(payment['close-amount'])

        if (transaction.sender === address) {
            add(deltas, ALGO_ASSET_KEY, -toBigInt(payment.amount))
            if (closeTo) add(deltas, ALGO_ASSET_KEY, -closeAmount)
        }
        if (payment.receiver === address) {
            add(deltas, ALGO_ASSET_KEY, toBigInt(payment.amount))
        }
        if (closeTo === address) {
            add(deltas, ALGO_ASSET_KEY, closeAmount)
        }
    }

    const transfer = transaction['asset-transfer-transaction']
    if (transfer) {
        const assetId = toBigInt(transfer['asset-id']).toString()
        // On a clawback, `transfer.sender` (the nested field — see
        // AssetTransferLeg above) holds the address actually debited. The
        // enclosing transaction's own `sender` is the clawback authority,
        // not the account it clawed back from.
        const debited = transfer.sender ?? transaction.sender
        const closeTo = transfer['close-to']
        const closeAmount = toBigInt(transfer['close-amount'])

        if (debited === address) {
            add(deltas, assetId, -toBigInt(transfer.amount))
            if (closeTo) add(deltas, assetId, -closeAmount)
        }
        if (transfer.receiver === address) {
            add(deltas, assetId, toBigInt(transfer.amount))
        }
        if (closeTo === address) {
            add(deltas, assetId, closeAmount)
        }
    }

    for (const inner of transaction['inner-txns'] ?? []) {
        accumulate(inner, address, deltas)
    }
}

/**
 * Net per-asset balance change for `address`, summed across the transaction and
 * every inner transaction, matching the Pera backend's `balance_impacts` shape.
 * Assets whose net change is zero are omitted — the field describes balances
 * that actually moved. ALGO sorts first, then ascending asset id, so the UI
 * renders a stable order.
 */
export const computeBalanceImpacts = (
    transaction: IndexerTransactionLike,
    address: string,
): BalanceImpact[] => {
    const deltas = new Map<string, bigint>()
    accumulate(transaction, address, deltas)

    return [...deltas.entries()]
        .filter(([, amount]) => amount !== 0n)
        .map(([assetId, amount]) => ({ assetId, amount }))
        .sort((a, b) => {
            if (a.assetId === ALGO_ASSET_KEY) return -1
            if (b.assetId === ALGO_ASSET_KEY) return 1
            return BigInt(a.assetId) < BigInt(b.assetId) ? -1 : 1
        })
}
