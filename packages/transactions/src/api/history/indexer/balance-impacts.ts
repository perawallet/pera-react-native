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
    amount: number | bigint
    receiver: string
    'close-remainder-to'?: string
    'close-amount'?: number | bigint
}

type AssetTransferLeg = {
    'asset-id': number | bigint
    amount: number | bigint
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
    'close-amount'?: number | bigint
}

/** The recursive subset of an indexer transaction this math reads. */
export type IndexerTransactionLike = {
    'tx-type': string
    sender: string
    fee: number | bigint
    'payment-transaction'?: PaymentLeg
    'asset-transfer-transaction'?: AssetTransferLeg
    'inner-txns'?: IndexerTransactionLike[]
}

export type BalanceImpact = {
    assetId: string
    /** Signed, in the asset's base units. Negative = left the account. */
    amount: bigint
}

const toBigInt = (value: number | bigint | undefined): bigint =>
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
    // call — observed values up to 20000 microAlgos on mainnet). That never
    // double-charges a single address: an inner transaction's sender can
    // only be the app's own account (or an account rekeyed to it), which in
    // every sampled case differed from every ancestor's sender.
    if (transaction.sender === address) {
        add(deltas, ALGO_ASSET_KEY, -toBigInt(transaction.fee))
    }

    // Real indexer transactions also carry `sender-rewards`,
    // `receiver-rewards` and `close-rewards`. They are deliberately not
    // modeled here and not part of `IndexerTransactionLike`. Algorand's
    // participation-rewards pool was drained years ago, so these fields are
    // 0 on current-era data — confirmed against thousands of live betanet,
    // fnet, and near-tip mainnet indexer transactions. This is NOT true of
    // mainnet's older history (nonzero rewards observed as far back as
    // round ~5M-30M) — irrelevant here because mainnet and testnet keep
    // using the Pera backend (which computes balance_impacts itself); this
    // function is only ever reached for betanet/fnet/localnet history, none
    // of which has an old reward-bearing era to replay.
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
