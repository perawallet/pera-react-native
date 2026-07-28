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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

/** Asset id used for the native ALGO balance in {@link BalanceImpact} deltas. */
export const ALGO_BALANCE_IMPACT_ASSET_ID = '0'

export type BalanceImpactDelta = {
    /** Asset id; `'0'` denotes the native ALGO balance. */
    assetId: string
    /** Net change in base units. Positive = received, negative = spent. */
    amount: bigint
}

export type BalanceImpactCreatedAsset = {
    /**
     * Row key. A minted asset has no id until the group is confirmed (`acfg`
     * carries `assetId: 0`, which is ALGO's id here), so it can't be netted
     * into {@link BalanceImpact.deltas} and is keyed by group position.
     */
    key: string
    name?: string
    unitName?: string
    /** Total supply credited to the creator, in base units. */
    total: bigint
    decimals: number
}

export type BalanceImpact = {
    /**
     * Net per-asset movement across the whole group for the user's accounts.
     * Assets whose movements cancel out (e.g. an internal transfer) are
     * omitted. Order follows first-seen; the view layer sorts for display.
     */
    deltas: BalanceImpactDelta[]
    /** Total fees (µAlgo) the user's accounts pay across the group. */
    totalFeeMicroAlgos: bigint
    /**
     * A close-remainder that sweeps a user account's remaining balance is
     * present. The real outflow then exceeds the explicit `amount`, so the UI
     * must flag it rather than imply the delta is the full story.
     */
    hasCloseRemainder: boolean
    /**
     * Asset ids (`'0'` = ALGO) whose entire remaining balance is swept from a
     * user account by a close-remainder/close-to. The explicit `amount` in
     * `deltas` understates the true outflow for these, so the UI must present
     * them as the full balance rather than the partial figure.
     */
    closedAssetIds: string[]
    /**
     * Assets minted by one of the user's accounts in this group. A mint moves no
     * existing asset, so it produces no delta — without this a mint group (e.g.
     * a multi-mint) has no impact to show at all.
     */
    createdAssets: BalanceImpactCreatedAsset[]
}

const toBig = (value: bigint | number | undefined): bigint => {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number') return BigInt(Math.trunc(value))
    return 0n
}

/**
 * Net balance impact of a transaction group on the wallet's own accounts.
 *
 * Pure arithmetic over the decoded group — no metadata, prices, or network.
 * For each transfer it credits the receiver and debits the spender when that
 * party is one of `userAddresses`, then nets per asset. Fees are accumulated
 * separately (the design surfaces them as their own line, not folded into the
 * ALGO delta). Clawback debits the asset's `sender` (the clawback target), not
 * the transaction sender. Internal transfers (user → user) net to zero and
 * drop out.
 *
 * `userAddresses` should be the accounts whose impact we're computing —
 * typically the pipeline's signable addresses.
 */
export const computeBalanceImpact = (
    transactions: PeraDisplayableTransaction[],
    userAddresses: Set<string>,
): BalanceImpact => {
    const net = new Map<string, bigint>()
    let totalFeeMicroAlgos = 0n
    const closedAssets = new Set<string>()
    const createdAssets: BalanceImpactCreatedAsset[] = []

    const move = (assetId: string, amount: bigint): void => {
        if (amount === 0n) return
        net.set(assetId, (net.get(assetId) ?? 0n) + amount)
    }

    for (const [index, tx] of transactions.entries()) {
        const sender = tx.sender
        const senderIsUser = !!sender && userAddresses.has(sender)

        // Fees are paid in ALGO by the transaction sender.
        if (senderIsUser) {
            totalFeeMicroAlgos += toBig(tx.fee)
        }

        const payment = tx.paymentTransaction
        if (payment) {
            const amount = toBig(payment.amount)
            if (senderIsUser) move(ALGO_BALANCE_IMPACT_ASSET_ID, -amount)
            if (payment.receiver && userAddresses.has(payment.receiver)) {
                move(ALGO_BALANCE_IMPACT_ASSET_ID, amount)
            }
            if (payment.closeRemainderTo && senderIsUser) {
                closedAssets.add(ALGO_BALANCE_IMPACT_ASSET_ID)
            }
        }

        const axfer = tx.assetTransferTransaction
        if (axfer) {
            const assetId = axfer.assetId.toString()
            const amount = toBig(axfer.amount)
            // Clawback pulls from the asset's `sender`; otherwise the holder
            // being debited is the transaction sender.
            const debited = axfer.sender ?? sender
            if (debited && userAddresses.has(debited)) move(assetId, -amount)
            if (axfer.receiver && userAddresses.has(axfer.receiver)) {
                move(assetId, amount)
            }
            if (axfer.closeTo && debited && userAddresses.has(debited)) {
                closedAssets.add(assetId)
            }
        }

        // A mint credits the creator with the whole supply. `assetId: 0` marks
        // a create (an update/destroy names the existing asset).
        const acfg = tx.assetConfigTransaction
        if (acfg && senderIsUser && toBig(acfg.assetId) === 0n) {
            createdAssets.push({
                key: `created-${index}`,
                name: acfg.params?.name,
                unitName: acfg.params?.unitName,
                total: toBig(acfg.params?.total),
                decimals: Number(acfg.params?.decimals ?? 0),
            })
        }
    }

    const deltas: BalanceImpactDelta[] = [...net.entries()]
        .filter(([, amount]) => amount !== 0n)
        .map(([assetId, amount]) => ({ assetId, amount }))

    return {
        deltas,
        totalFeeMicroAlgos,
        hasCloseRemainder: closedAssets.size > 0,
        closedAssetIds: [...closedAssets],
        createdAssets,
    }
}
